package cmdr

import (
	"regexp"
	"strings"
)

const (
	versionFlags       = "-V, --version"
	versionDescription = "output the version number"

	helpFlagShort   = "-h"
	helpFlagLong    = "--help"
	helpFlags       = "-h, --help"
	helpDescription = "display help for command"
	helpCommandName = "help"
	helpCommandArgs = "[command]"
)

// Option is a declared command line option.
type Option struct {
	flags       string
	description string

	short string
	long  string

	required bool // takes a required value, e.g. --platform <ids>
	optional bool // takes an optional value, e.g. --platform [ids]
	variadic bool // accepts a variable number of values

	hasDefault   bool
	defaultValue any

	choices []string
}

// newOption parses the commander flag syntax.
func newOption(flags string, description string) *Option {
	short, long := splitOptionFlags(flags)
	return &Option{
		flags:       flags,
		description: description,
		short:       short,
		long:        long,
		required:    strings.Contains(flags, "<"),
		optional:    strings.Contains(flags, "["),
		variadic:    variadicFlagsRegex.MatchString(flags),
	}
}

var variadicFlagsRegex = regexp.MustCompile(`\w\.\.\.[>\]]`)

// splitOptionFlags splits a flag definition into its short and long form. It
// mirrors commander's splitOptionFlags().
func splitOptionFlags(flags string) (short string, long string) {
	parts := strings.FieldsFunc(flags, func(r rune) bool {
		return r == ' ' || r == '|' || r == ','
	})

	if len(parts) > 0 && isShortFlag(parts[0]) {
		short = parts[0]
		parts = parts[1:]
	}
	if len(parts) > 0 && isLongFlag(parts[0]) {
		long = parts[0]
		parts = parts[1:]
	}
	if short == "" && len(parts) > 0 && isShortFlag(parts[0]) {
		short = parts[0]
		parts = parts[1:]
	}
	if long == "" && len(parts) > 0 && isLongFlag(parts[0]) {
		long = parts[0]
		parts = parts[1:]
	}
	return short, long
}

func isShortFlag(s string) bool {
	return len(s) == 2 && s[0] == '-' && s[1] != '-'
}

func isLongFlag(s string) bool {
	return len(s) > 2 && strings.HasPrefix(s, "--") && s[2] != '-'
}

// name returns the canonical option name: the long flag without dashes, or
// the short flag without the dash.
func (o *Option) name() string {
	if o.long != "" {
		return strings.TrimPrefix(o.long, "--")
	}
	if o.short != "" {
		return strings.TrimPrefix(o.short, "-")
	}
	return ""
}

// isBoolean reports whether the option is a flag that does not take a value.
func (o *Option) isBoolean() bool { return !o.required && !o.optional }

// Flags returns the raw flag definition, e.g. "--platform <ids>".
func (o *Option) Flags() string { return o.flags }

// Description returns the option description.
func (o *Option) Description() string { return o.description }

// addOption registers an option with the command.
func (c *Command) addOption(opt *Option) {
	c.options = append(c.options, opt)
}

// parseArgumentSpec parses an argument declaration such as "<action>",
// "[action]" or "action".
func parseArgumentSpec(spec string) *Argument {
	arg := &Argument{}
	name := strings.TrimSpace(spec)
	switch {
	case strings.HasPrefix(name, "<") && strings.HasSuffix(name, ">"):
		arg.required = true
		name = name[1 : len(name)-1]
	case strings.HasPrefix(name, "[") && strings.HasSuffix(name, "]"):
		arg.optional = true
		name = name[1 : len(name)-1]
	}
	if strings.HasSuffix(name, "...") {
		arg.variadic = true
		name = strings.TrimSuffix(name, "...")
	}
	arg.name = name
	return arg
}
