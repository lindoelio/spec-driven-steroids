// Package cmdr implements a small, dependency-free command-line framework whose
// observable behaviour matches the `commander` npm package (v11) that the
// TypeScript CLI used before the Go rewrite.
//
// The goal is byte-identical user visible output: the same `Usage:` line, the
// same help layout, the same error strings and the same exit code semantics.
//
// The two error strings that commander prints itself are reproduced verbatim on
// stderr:
//
//	error: unknown option '--bogus'
//	error: unknown command 'bogus-cmd'
//
// Everything else is returned as an error so the caller decides what to print
// and which exit code to use. Usage problems are reported as *UsageError.
package cmdr

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
)

// ActionFunc is the signature of a command action handler.
type ActionFunc = func(cmd *Command, args []string) error

// UsageError marks an error that is caused by incorrect command line usage
// (unknown command, unknown option, missing option argument, wrong number of
// arguments, invalid option value, missing subcommand).
//
// The framework prints the diagnostic itself, in the wording of the previous
// release, and the entry point maps the error to the failure exit code, so
// that the exit codes of the previous release stay unchanged.
type UsageError struct{ msg string }

// NewUsageError builds a UsageError with the given message.
func NewUsageError(msg string) *UsageError { return &UsageError{msg: msg} }

// Error implements the error interface.
func (e *UsageError) Error() string { return e.msg }

// IsUsageError reports whether err (or any error it wraps) is a *UsageError.
func IsUsageError(err error) bool {
	var ue *UsageError
	return errors.As(err, &ue)
}

// Argument is a declared positional argument.
type Argument struct {
	name        string
	description string
	required    bool
	optional    bool
	variadic    bool
}

// Name returns the argument name without angle brackets.
func (a *Argument) Name() string { return a.name }

// Description returns the argument description.
func (a *Argument) Description() string { return a.description }

// Required reports whether the argument must be supplied.
func (a *Argument) Required() bool { return a.required }

// Variadic reports whether the argument accepts a variable number of values.
func (a *Argument) Variadic() bool { return a.variadic }

// humanReadableArgName mirrors commander's humanReadableArgName().
func humanReadableArgName(a *Argument) string {
	name := a.name
	if a.variadic {
		name += "..."
	}
	if a.required {
		return "<" + name + ">"
	}
	return "[" + name + "]"
}

// Command is a node of the command tree. A command may have options,
// positional arguments, subcommands and an action handler.
type Command struct {
	name        string
	aliases     []string
	description string
	summary     string

	options   []*Option
	arguments []*Argument
	commands  []*Command
	parent    *Command

	action ActionFunc

	version       string
	versionOption *Option

	// parsed state
	values   map[string]string
	changed  map[string]bool
	operands []string

	// excess arguments are accepted, like commander does by default; see
	// AllowExcessArguments.
	allowExcessArguments bool

	out io.Writer
	err io.Writer
}

// New creates a command with the given name.
func New(name string) *Command {
	return &Command{
		name:    name,
		values:  map[string]string{},
		changed: map[string]bool{},
		// Commander accepts surplus positional arguments unless a program
		// opts out of it.
		allowExcessArguments: true,
	}
}

// Alias registers an alternative name for the command.
func (c *Command) Alias(a string) *Command {
	c.aliases = append(c.aliases, a)
	return c
}

// Description sets the command description shown in the help output.
func (c *Command) Description(d string) *Command {
	c.description = d
	return c
}

// Version sets the program version. Like commander it registers an implicit
// `-V, --version` option.
func (c *Command) Version(v string) *Command {
	c.version = v
	if c.versionOption == nil {
		c.versionOption = newOption(versionFlags, versionDescription)
		c.addOption(c.versionOption)
	}
	return c
}

// Option declares an option. `flags` uses the commander syntax, e.g.
// "--dry-run", "--platform <ids>", "--scope=<scope>" or "-y, --yes".
func (c *Command) Option(flags string, description string) *Command {
	c.addOption(newOption(flags, description))
	return c
}

// OptionWithDefault declares an option that has a default value. The default
// is shown in the help output the same way commander shows it.
func (c *Command) OptionWithDefault(flags string, description string, defaultValue any) *Command {
	opt := newOption(flags, description)
	opt.hasDefault = true
	opt.defaultValue = defaultValue
	c.addOption(opt)
	return c
}

// OptionWithChoices declares an option that only accepts the given values.
// Supplying another value is a usage error.
func (c *Command) OptionWithChoices(flags string, description string, choices []string) *Command {
	opt := newOption(flags, description)
	opt.choices = append([]string(nil), choices...)
	c.addOption(opt)
	return c
}

// Argument declares a positional argument. The name may be given with or
// without angle brackets: "<action>", "[action]" and "action" are all valid.
func (c *Command) Argument(name string, description string) *Command {
	arg := parseArgumentSpec(name)
	arg.description = description
	c.arguments = append(c.arguments, arg)
	return c
}

// Command creates a subcommand, adds it to this command and returns it.
func (c *Command) Command(name string) *Command {
	sub := New(name)
	c.AddCommand(sub)
	return sub
}

// AddCommand adds an existing command as a subcommand.
func (c *Command) AddCommand(sub *Command) {
	if sub == nil {
		return
	}
	sub.parent = c
	c.commands = append(c.commands, sub)
}

// Action registers the handler invoked when the command is dispatched.
func (c *Command) Action(fn func(cmd *Command, args []string) error) *Command {
	c.action = fn
	return c
}

// AllowExcessArguments toggles whether surplus positional arguments are
// accepted. Commander allows them by default; this framework reports them as
// a usage error unless this is called with true.
func (c *Command) AllowExcessArguments(allow bool) *Command {
	c.allowExcessArguments = allow
	return c
}

// SetOut sets the writer used for standard output (help, version).
func (c *Command) SetOut(w io.Writer) *Command {
	c.out = w
	return c
}

// SetErr sets the writer used for standard error.
func (c *Command) SetErr(w io.Writer) *Command {
	c.err = w
	return c
}

// Name returns the command name.
func (c *Command) Name() string { return c.name }

// Aliases returns the registered alternative names.
func (c *Command) Aliases() []string { return c.aliases }

// Parent returns the parent command, or nil for the root command.
func (c *Command) Parent() *Command { return c.parent }

// Commands returns the registered subcommands.
func (c *Command) Commands() []*Command { return c.commands }

// ---------------------------------------------------------------------------
// Option access
// ---------------------------------------------------------------------------

// lookupOption finds an option by its long name (without dashes). For
// convenience the camelCase spelling of a dashed name is accepted too.
func (c *Command) lookupOption(name string) *Option {
	name = strings.TrimLeft(name, "-")
	if opt := c.findOptionByName(name); opt != nil {
		return opt
	}
	if kebab := camelToKebab(name); kebab != name {
		return c.findOptionByName(kebab)
	}
	return nil
}

func (c *Command) findOptionByName(name string) *Option {
	for _, opt := range c.options {
		if opt.name() == name {
			return opt
		}
	}
	return nil
}

// OptString returns the value of the named option, or "" when it is absent.
func (c *Command) OptString(name string) string {
	opt := c.lookupOption(name)
	if opt == nil {
		return ""
	}
	return c.values[opt.name()]
}

// OptBool returns the boolean value of the named option, or false when it is
// absent.
func (c *Command) OptBool(name string) bool {
	opt := c.lookupOption(name)
	if opt == nil {
		return false
	}
	value, ok := c.values[opt.name()]
	if !ok {
		return false
	}
	if opt.isBoolean() {
		return value != "false"
	}
	switch strings.ToLower(value) {
	case "", "false", "0", "no":
		return false
	default:
		return true
	}
}

// OptInt returns the integer value of the named option, or 0 when it is absent
// or not a valid integer.
func (c *Command) OptInt(name string) int {
	value := c.OptString(name)
	if value == "" {
		return 0
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return n
}

// Changed reports whether the named option was explicitly provided.
func (c *Command) Changed(name string) bool {
	opt := c.lookupOption(name)
	if opt == nil {
		return false
	}
	return c.changed[opt.name()]
}

// ---------------------------------------------------------------------------
// Argument access
// ---------------------------------------------------------------------------

// Args returns the positional arguments of the dispatched command.
func (c *Command) Args() []string { return c.operands }

// Arg returns the i-th positional argument, or "" when it does not exist.
func (c *Command) Arg(i int) string {
	if i < 0 || i >= len(c.operands) {
		return ""
	}
	return c.operands[i]
}

// ArgCount returns the number of positional arguments.
func (c *Command) ArgCount() int { return len(c.operands) }

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

// Execute parses os.Args[1:] and dispatches to the matching command.
func (c *Command) Execute() error {
	return c.Parse(os.Args[1:])
}

// Parse parses the given arguments (without the program name) and dispatches
// to the matching command.
func (c *Command) Parse(args []string) error {
	c.reset()
	return c.parseCommand(nil, args)
}

// reset clears the parsed state so a command tree can be parsed repeatedly.
func (c *Command) reset() {
	c.values = map[string]string{}
	c.changed = map[string]bool{}
	c.operands = nil
	c.applyDefaults()
	for _, sub := range c.commands {
		sub.reset()
	}
}

// applyDefaults seeds the parsed state with the declared defaults.
//
// The value a program reads for an option that was not given is the default
// it declared, exactly like commander exposes it.
func (c *Command) applyDefaults() {
	for _, opt := range c.options {
		if !opt.hasDefault {
			continue
		}
		c.values[opt.name()] = defaultValueOf(opt)
	}
}

// defaultValueOf renders the declared default of an option.
func defaultValueOf(opt *Option) string {
	switch value := opt.defaultValue.(type) {
	case nil:
		return ""
	case string:
		return value
	case bool:
		if value {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprint(value)
	}
}

// parseCommand mirrors commander's _parseCommand().
func (c *Command) parseCommand(operands []string, unknown []string) error {
	parsedOperands, parsedUnknown, err := c.parseOptions(unknown)
	if err != nil {
		return err
	}
	operands = append(append([]string{}, operands...), parsedOperands...)
	unknown = parsedUnknown
	c.operands = append(append([]string{}, operands...), unknown...)

	// A version flag short circuits everything, exactly like commander.
	if c.versionOption != nil && c.changed[c.versionOption.name()] {
		fmt.Fprintln(c.outWriter(), c.version)
		return nil
	}

	if len(operands) > 0 {
		if sub := c.findCommand(operands[0]); sub != nil {
			return sub.parseCommand(operands[1:], unknown)
		}
	}
	if c.hasImplicitHelpCommand() && len(operands) > 0 && operands[0] == helpCommandName {
		return c.dispatchHelpCommand(operands[1:])
	}

	// A parent command without an action and without arguments prints its help
	// on stderr; commander exits with code 1 there.
	if len(c.commands) > 0 && len(c.operands) == 0 && c.action == nil {
		return c.printHelpOnStderr()
	}

	if c.helpRequested(unknown) {
		fmt.Fprint(c.outWriter(), c.HelpString())
		return nil
	}

	if c.action != nil {
		if err := c.checkUnknownOptions(unknown); err != nil {
			return err
		}
		if err := c.checkNumberOfArguments(); err != nil {
			return err
		}
		return c.action(c, c.operands)
	}

	if len(operands) > 0 {
		if len(c.commands) > 0 {
			return c.unknownCommand(operands[0])
		}
		if err := c.checkUnknownOptions(unknown); err != nil {
			return err
		}
		return c.checkNumberOfArguments()
	}

	if len(c.commands) > 0 {
		if err := c.checkUnknownOptions(unknown); err != nil {
			return err
		}
		return c.printHelpOnStderr()
	}

	if err := c.checkUnknownOptions(unknown); err != nil {
		return err
	}
	return c.checkNumberOfArguments()
}

// parseOptions splits the arguments into operands and unknown options. It
// mirrors commander's parseOptions().
func (c *Command) parseOptions(args []string) ([]string, []string, error) {
	operands := []string{}
	unknown := []string{}
	dest := &operands
	rest := append([]string{}, args...)

	maybeOption := func(arg string) bool {
		return len(arg) > 1 && arg[0] == '-'
	}

	for len(rest) > 0 {
		arg := rest[0]
		rest = rest[1:]

		// "--" terminates option parsing: everything after is positional.
		if arg == "--" {
			if dest == &unknown {
				unknown = append(unknown, arg)
			}
			*dest = append(*dest, rest...)
			break
		}

		if opt := c.findOption(arg); opt != nil {
			var err error
			switch {
			case opt.required:
				if len(rest) == 0 {
					return nil, nil, c.optionMissingArgument(opt)
				}
				value := rest[0]
				rest = rest[1:]
				err = c.setOption(opt, value)
			case opt.optional:
				value := ""
				if len(rest) > 0 && !maybeOption(rest[0]) {
					value = rest[0]
					rest = rest[1:]
				}
				err = c.setOption(opt, value)
			default:
				err = c.setOption(opt, "true")
			}
			if err != nil {
				return nil, nil, err
			}
			continue
		}

		// Combined short flags, e.g. "-abc". A value taking option consumes the
		// remainder of the argument.
		if len(arg) > 2 && arg[0] == '-' && arg[1] != '-' {
			if opt := c.findOption(arg[:2]); opt != nil {
				if opt.required || opt.optional {
					if err := c.setOption(opt, arg[2:]); err != nil {
						return nil, nil, err
					}
				} else {
					if err := c.setOption(opt, "true"); err != nil {
						return nil, nil, err
					}
					rest = append([]string{"-" + arg[2:]}, rest...)
				}
				continue
			}
		}

		// Long flag with an inline value, e.g. "--scope=project".
		if strings.HasPrefix(arg, "--") {
			if idx := strings.Index(arg, "="); idx > 2 {
				if opt := c.findOption(arg[:idx]); opt != nil && (opt.required || opt.optional) {
					if err := c.setOption(opt, arg[idx+1:]); err != nil {
						return nil, nil, err
					}
					continue
				}
			}
		}

		// Not a recognised option: everything that follows is unknown too, so
		// that a subcommand can still consume it.
		if maybeOption(arg) {
			dest = &unknown
		}
		*dest = append(*dest, arg)
	}

	return operands, unknown, nil
}

// optionMissingArgument reports an option that was used without its value.
func (c *Command) optionMissingArgument(opt *Option) error {
	message := fmt.Sprintf("error: option '%s' argument missing", opt.flags)
	fmt.Fprintln(c.errWriter(), message)
	return NewUsageError(message)
}

// setOption records an option value and validates the allowed choices.
func (c *Command) setOption(opt *Option, value string) error {
	c.values[opt.name()] = value
	c.changed[opt.name()] = true
	if len(opt.choices) > 0 && !containsString(opt.choices, value) {
		return c.invalidOptionValue(opt, value)
	}
	return nil
}

// invalidOptionValue reports a value that is not among the allowed choices.
func (c *Command) invalidOptionValue(opt *Option, value string) error {
	message := fmt.Sprintf(
		"error: option '%s' argument '%s' is invalid. Allowed choices are %s.",
		opt.flags, value, strings.Join(opt.choices, ", "))
	fmt.Fprintln(c.errWriter(), message)
	return NewUsageError(message)
}

// findOption finds an option by its exact flag spelling ("--dry-run", "-y").
func (c *Command) findOption(flag string) *Option {
	for _, opt := range c.options {
		if opt.short == flag || opt.long == flag {
			return opt
		}
	}
	return nil
}

// findCommand finds a subcommand by name or alias.
func (c *Command) findCommand(name string) *Command {
	if name == "" {
		return nil
	}
	for _, sub := range c.commands {
		if sub.name == name {
			return sub
		}
		for _, alias := range sub.aliases {
			if alias == name {
				return sub
			}
		}
	}
	return nil
}

// hasImplicitHelpCommand reports whether the implicit "help [command]" command
// is available.
func (c *Command) hasImplicitHelpCommand() bool {
	if len(c.commands) == 0 {
		return false
	}
	return c.findCommand(helpCommandName) == nil
}

// helpRequested reports whether a help flag is present in the unknown args.
func (c *Command) helpRequested(unknown []string) bool {
	for _, arg := range unknown {
		if arg == helpFlagLong || arg == helpFlagShort {
			return true
		}
	}
	return false
}

// dispatchHelpCommand implements the implicit "help [command]" command.
func (c *Command) dispatchHelpCommand(subcommandName []string) error {
	if len(subcommandName) == 0 {
		fmt.Fprint(c.outWriter(), c.HelpString())
		return nil
	}
	name := subcommandName[0]
	sub := c.findCommand(name)
	if sub == nil {
		// Commander prints the help of the program on stderr and exits with
		// code 1 when the named command does not exist.
		fmt.Fprint(c.errWriter(), c.ErrorHelpString())
		return NewUsageError(fmt.Sprintf("error: unknown command '%s'", name))
	}
	fmt.Fprint(c.outWriter(), sub.HelpString())
	return nil
}

// unknownCommand reports an unknown subcommand, printing commander's message.
func (c *Command) unknownCommand(name string) error {
	message := fmt.Sprintf("error: unknown command '%s'%s", name, c.suggestCommand(name))
	fmt.Fprintln(c.errWriter(), message)
	return NewUsageError(message)
}

// unknownOption reports an unknown option, printing commander's message.
func (c *Command) unknownOption(flag string) error {
	message := fmt.Sprintf("error: unknown option '%s'%s", flag, c.suggestOption(flag))
	fmt.Fprintln(c.errWriter(), message)
	return NewUsageError(message)
}

// suggestCommand returns the suggestion commander appends to an unknown
// command message.
func (c *Command) suggestCommand(name string) string {
	candidates := []string{}
	for _, sub := range c.commands {
		candidates = append(candidates, sub.name)
		candidates = append(candidates, sub.aliases...)
	}
	return suggestSimilar(name, candidates)
}

// suggestOption returns the suggestion commander appends to an unknown option
// message.
//
// Commander walks the parents of the command and collects the long flag of
// every option each of them shows, including the implicit help option, so a
// mistyped help flag is suggested like any other.
func (c *Command) suggestOption(flag string) string {
	candidates := []string{}
	for command := c; command != nil; command = command.parent {
		for _, opt := range visibleOptions(command) {
			if opt.long != "" {
				candidates = append(candidates, opt.long)
			}
		}
		if command.versionOption != nil && command.versionOption.long != "" {
			candidates = append(candidates, command.versionOption.long)
		}
	}
	return suggestSimilar(flag, candidates)
}

// checkUnknownOptions reports the first unknown option.
func (c *Command) checkUnknownOptions(unknown []string) error {
	if len(unknown) > 0 {
		return c.unknownOption(unknown[0])
	}
	return nil
}

// checkNumberOfArguments verifies that the declared arguments are satisfied.
func (c *Command) checkNumberOfArguments() error {
	for i, arg := range c.arguments {
		if arg.required && i >= len(c.operands) {
			message := fmt.Sprintf("error: missing required argument '%s'", arg.name)
			fmt.Fprintln(c.errWriter(), message)
			return NewUsageError(message)
		}
	}
	if len(c.arguments) > 0 {
		last := c.arguments[len(c.arguments)-1]
		if last.variadic {
			return nil
		}
	}
	if !c.allowExcessArguments && len(c.operands) > len(c.arguments) {
		expected := len(c.arguments)
		plural := "s"
		if expected == 1 {
			plural = ""
		}
		forSubcommand := ""
		if c.parent != nil {
			forSubcommand = fmt.Sprintf(" for '%s'", c.name)
		}
		message := fmt.Sprintf("error: too many arguments%s. Expected %d argument%s but got %d.",
			forSubcommand, expected, plural, len(c.operands))
		fmt.Fprintln(c.errWriter(), message)
		return NewUsageError(message)
	}
	return nil
}

// printHelpOnStderr prints the help text on stderr. Commander does the same
// when a parent command is invoked without a subcommand and exits with code 1.
//
// The help that follows a failure is measured against the standard error, so
// it is wrapped at the width of that stream.
func (c *Command) printHelpOnStderr() error {
	fmt.Fprint(c.errWriter(), c.ErrorHelpString())
	return NewUsageError("error: missing required command")
}

// outWriter returns the writer used for standard output.
func (c *Command) outWriter() io.Writer {
	for cmd := c; cmd != nil; cmd = cmd.parent {
		if cmd.out != nil {
			return cmd.out
		}
	}
	return os.Stdout
}

// errWriter returns the writer used for standard error.
func (c *Command) errWriter() io.Writer {
	for cmd := c; cmd != nil; cmd = cmd.parent {
		if cmd.err != nil {
			return cmd.err
		}
	}
	return os.Stderr
}

func containsString(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}

// camelToKebab converts a camelCase option name to the dashed spelling.
func camelToKebab(name string) string {
	var b strings.Builder
	for i, r := range name {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				b.WriteByte('-')
			}
			b.WriteRune(r + ('a' - 'A'))
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
