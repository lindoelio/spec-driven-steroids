package cmdr

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
)

// The help renderer is a port of commander's Help class (help.js). The layout
// constants below are the ones commander uses:
//
//   - helpWidth: the total width of the help text (80 when stdout is not a
//     terminal, which is what the captured fixtures use).
//   - itemIndentWidth: the indentation of every list item (2).
//   - itemSeparatorWidth: the gap between the term and its description (2).
//   - minColumnWidth: below this width commander does not wrap at all.
const (
	defaultHelpWidth   = 80
	itemIndentWidth    = 2
	itemSeparatorWidth = 2
	minColumnWidth     = 40
)

// helpRenderer renders the help text of a command.
type helpRenderer struct {
	helpWidth int
}

// HelpString returns the exact help text commander would print for the
// command.
func (c *Command) HelpString() string {
	r := &helpRenderer{helpWidth: c.outputHelpWidth()}
	return r.formatHelp(c)
}

// ErrorHelpString returns the help text the way commander prints it on the
// standard error.
//
// Commander measures the standard output when it prints the help and the
// standard error when it prints it after a failure, so the two widths differ
// in a terminal that has more than one size.
func (c *Command) ErrorHelpString() string {
	r := &helpRenderer{helpWidth: c.errorHelpWidth()}
	return r.formatHelp(c)
}

// outputHelpWidth returns the width commander would use for the help text
// printed on the standard output.
//
// A terminal reports its width; anything else falls back to the default,
// the way commander does when the output is not a terminal.
func (c *Command) outputHelpWidth() int {
	if width := terminalWidth(writerFile(c.outWriter())); width > 0 {
		return width
	}
	return defaultHelpWidth
}

// errorHelpWidth returns the width commander would use for the help text
// printed on the standard error.
func (c *Command) errorHelpWidth() int {
	if width := terminalWidth(writerFile(c.errWriter())); width > 0 {
		return width
	}
	return defaultHelpWidth
}

// writerFile returns the file behind a writer, when it is one.
func writerFile(writer io.Writer) *os.File {
	file, _ := writer.(*os.File)
	return file
}

// visibleCommands returns the subcommands including the implicit
// "help [command]" command.
func (r *helpRenderer) visibleCommands(cmd *Command) []*Command {
	commands := make([]*Command, 0, len(cmd.commands)+1)
	commands = append(commands, cmd.commands...)
	if cmd.hasImplicitHelpCommand() {
		helpCommand := New(helpCommandName)
		helpCommand.description = helpDescription
		helpCommand.arguments = []*Argument{{name: "command", optional: true}}
		commands = append(commands, helpCommand)
	}
	return commands
}

// visibleOptions returns the options including the implicit help option.
func (r *helpRenderer) visibleOptions(cmd *Command) []*Option {
	return visibleOptions(cmd)
}

// visibleOptions returns the options of a command including the implicit help
// option.
//
// The implicit help option is part of the surface the user sees, so it also
// belongs to the candidates the suggestion for an unknown option compares.
func visibleOptions(cmd *Command) []*Option {
	options := make([]*Option, 0, len(cmd.options)+1)
	options = append(options, cmd.options...)

	hasShort := cmd.findOption(helpFlagShort) != nil
	hasLong := cmd.findOption(helpFlagLong) != nil
	switch {
	case !hasShort && !hasLong:
		options = append(options, newOption(helpFlags, helpDescription))
	case !hasShort:
		options = append(options, newOption(helpFlagShort, helpDescription))
	case !hasLong:
		options = append(options, newOption(helpFlagLong, helpDescription))
	}
	return options
}

// visibleArguments returns the declared arguments, but only when at least one
// of them has a description (commander hides the section otherwise).
func (r *helpRenderer) visibleArguments(cmd *Command) []*Argument {
	for _, arg := range cmd.arguments {
		if arg.description != "" {
			return cmd.arguments
		}
	}
	return nil
}

// subcommandTerm is the term shown in the list of subcommands.
func (r *helpRenderer) subcommandTerm(cmd *Command) string {
	args := make([]string, 0, len(cmd.arguments))
	for _, arg := range cmd.arguments {
		args = append(args, humanReadableArgName(arg))
	}
	term := cmd.name
	if len(cmd.aliases) > 0 {
		term += "|" + cmd.aliases[0]
	}
	if len(cmd.options) > 0 {
		term += " [options]"
	}
	if len(args) > 0 {
		term += " " + strings.Join(args, " ")
	}
	return term
}

// optionTerm is the term shown in the list of options.
func (r *helpRenderer) optionTerm(opt *Option) string { return opt.flags }

// argumentTerm is the term shown in the list of arguments.
func (r *helpRenderer) argumentTerm(arg *Argument) string { return arg.name }

// commandUsage is the usage string shown after "Usage: ".
func (r *helpRenderer) commandUsage(cmd *Command) string {
	cmdName := cmd.name
	if len(cmd.aliases) > 0 {
		cmdName += "|" + cmd.aliases[0]
	}
	ancestorNames := ""
	for ancestor := cmd.parent; ancestor != nil; ancestor = ancestor.parent {
		ancestorNames = ancestor.name + " " + ancestorNames
	}
	return ancestorNames + cmdName + " " + cmd.usageString()
}

// commandDescription is the description of the command itself.
func (r *helpRenderer) commandDescription(cmd *Command) string { return cmd.description }

// subcommandDescription is the description shown for a subcommand.
func (r *helpRenderer) subcommandDescription(cmd *Command) string {
	if cmd.summary != "" {
		return cmd.summary
	}
	return cmd.description
}

// optionDescription is the description shown for an option, including the
// "default:" and "choices:" suffixes commander adds.
func (r *helpRenderer) optionDescription(opt *Option) string {
	var extra []string
	if len(opt.choices) > 0 {
		quoted := make([]string, 0, len(opt.choices))
		for _, choice := range opt.choices {
			quoted = append(quoted, jsonStringify(choice))
		}
		extra = append(extra, "choices: "+strings.Join(quoted, ", "))
	}
	if opt.hasDefault {
		showDefault := opt.required || opt.optional ||
			(opt.isBoolean() && isBooleanValue(opt.defaultValue))
		if showDefault {
			extra = append(extra, "default: "+jsonStringify(opt.defaultValue))
		}
	}
	if len(extra) > 0 {
		return opt.description + " (" + strings.Join(extra, ", ") + ")"
	}
	return opt.description
}

// argumentDescription is the description shown for an argument.
func (r *helpRenderer) argumentDescription(arg *Argument) string {
	return arg.description
}

// padWidth is the width of the widest term of the command.
func (r *helpRenderer) padWidth(cmd *Command) int {
	width := 0
	for _, opt := range r.visibleOptions(cmd) {
		if length := displayWidth(r.optionTerm(opt)); length > width {
			width = length
		}
	}
	for _, sub := range r.visibleCommands(cmd) {
		if length := displayWidth(r.subcommandTerm(sub)); length > width {
			width = length
		}
	}
	for _, arg := range r.visibleArguments(cmd) {
		if length := displayWidth(r.argumentTerm(arg)); length > width {
			width = length
		}
	}
	return width
}

// formatHelp renders the complete help text.
func (r *helpRenderer) formatHelp(cmd *Command) string {
	termWidth := r.padWidth(cmd)
	helpWidth := r.helpWidth

	formatItem := func(term string, description string) string {
		if description == "" {
			return term
		}
		fullText := padEnd(term, termWidth+itemSeparatorWidth) + description
		return wrapText(fullText, helpWidth-itemIndentWidth, termWidth+itemSeparatorWidth)
	}
	formatList := func(items []string) string {
		lines := strings.Split(strings.Join(items, "\n"), "\n")
		for i := range lines {
			lines[i] = strings.Repeat(" ", itemIndentWidth) + lines[i]
		}
		return strings.Join(lines, "\n")
	}

	output := []string{"Usage: " + r.commandUsage(cmd), ""}

	if description := r.commandDescription(cmd); description != "" {
		output = append(output, wrapText(description, helpWidth, 0), "")
	}

	if args := r.visibleArguments(cmd); len(args) > 0 {
		items := make([]string, 0, len(args))
		for _, arg := range args {
			items = append(items, formatItem(r.argumentTerm(arg), r.argumentDescription(arg)))
		}
		output = append(output, "Arguments:", formatList(items), "")
	}

	if options := r.visibleOptions(cmd); len(options) > 0 {
		items := make([]string, 0, len(options))
		for _, opt := range options {
			items = append(items, formatItem(r.optionTerm(opt), r.optionDescription(opt)))
		}
		output = append(output, "Options:", formatList(items), "")
	}

	if commands := r.visibleCommands(cmd); len(commands) > 0 {
		items := make([]string, 0, len(commands))
		for _, sub := range commands {
			items = append(items, formatItem(r.subcommandTerm(sub), r.subcommandDescription(sub)))
		}
		output = append(output, "Commands:", formatList(items), "")
	}

	return strings.Join(output, "\n")
}

// usageString is the "[options] [command] <args>" part of the usage line.
// Like commander it always advertises "[options]" because the implicit help
// option is always available.
func (c *Command) usageString() string {
	parts := []string{"[options]"}
	if len(c.commands) > 0 {
		parts = append(parts, "[command]")
	}
	if len(c.arguments) > 0 {
		args := make([]string, 0, len(c.arguments))
		for _, arg := range c.arguments {
			args = append(args, humanReadableArgName(arg))
		}
		parts = append(parts, args...)
	}
	return strings.Join(parts, " ")
}

// ---------------------------------------------------------------------------
// Text wrapping
// ---------------------------------------------------------------------------

// wrapText is a port of commander's Help.prototype.wrap().
func wrapText(str string, width int, indent int) string {
	// Manually formatted text (a line break followed by spaces) is never
	// re-wrapped.
	if hasManualIndent(str) {
		return str
	}
	columnWidth := width - indent
	if columnWidth < minColumnWidth {
		return str
	}

	runes := []rune(str)
	if indent > len(runes) {
		indent = len(runes)
	}
	leading := string(runes[:indent])
	columnText := string(runes[indent:])
	columnText = strings.Replace(columnText, "\r\n", "\n", 1)

	lines := matchWrapLines(columnText, columnWidth-1)
	indentString := strings.Repeat(" ", indent)
	for i, line := range lines {
		if line == "\n" {
			lines[i] = ""
			continue
		}
		if i > 0 {
			lines[i] = indentString + trimEndJS(line)
		} else {
			lines[i] = trimEndJS(line)
		}
	}
	return leading + strings.Join(lines, "\n")
}

// matchWrapLines splits the text the way commander's wrap regex does:
//
//	\n|.{1,n}([\s\u200B]|$)|[^\s\u200B]+?([\s\u200B]|$)
func matchWrapLines(text string, n int) []string {
	runes := []rune(text)
	lines := make([]string, 0, 8)
	for i := 0; i < len(runes); {
		if runes[i] == '\n' {
			lines = append(lines, "\n")
			i++
			continue
		}
		if match, next, ok := matchDotted(runes, i, n); ok {
			lines = append(lines, match)
			i = next
			continue
		}
		if match, next, ok := matchNonBreaking(runes, i); ok {
			lines = append(lines, match)
			i = next
			continue
		}
		lines = append(lines, string(runes[i:]))
		break
	}
	return lines
}

// matchDotted implements `.{1,n}([\s\u200B]|$)`: up to n characters that are
// not line terminators, followed by a break character or the end of the text.
func matchDotted(runes []rune, start int, n int) (string, int, bool) {
	max := 0
	for max < n && start+max < len(runes) && !isLineTerminator(runes[start+max]) {
		max++
	}
	for k := max; k >= 1; k-- {
		pos := start + k
		if pos == len(runes) {
			return string(runes[start:pos]), pos, true
		}
		if isBreakChar(runes[pos]) {
			return string(runes[start : pos+1]), pos + 1, true
		}
	}
	return "", 0, false
}

// matchNonBreaking implements `[^\s\u200B]+?([\s\u200B]|$)`.
func matchNonBreaking(runes []rune, start int) (string, int, bool) {
	i := start
	for i < len(runes) && !isBreakChar(runes[i]) {
		i++
	}
	if i == start {
		return "", 0, false
	}
	if i == len(runes) {
		return string(runes[start:i]), i, true
	}
	return string(runes[start : i+1]), i + 1, true
}

// hasManualIndent reports whether the text contains a line break followed by
// whitespace, which commander treats as manually formatted text.
func hasManualIndent(str string) bool {
	runes := []rune(str)
	for i := 0; i < len(runes); i++ {
		if runes[i] != '\n' {
			continue
		}
		for j := i + 1; j < len(runes) && isManualIndentChar(runes[j]); j++ {
			return true
		}
	}
	return false
}

func isManualIndentChar(r rune) bool {
	switch r {
	case ' ', '\f', '\t', '\v', '\u00a0', '\u1680', '\u202f', '\u205f', '\u3000', '\ufeff':
		return true
	}
	return r >= '\u2000' && r <= '\u200a'
}

// isBreakChar reports whether the rune belongs to the `[\s\u200B]` class.
func isBreakChar(r rune) bool {
	return isJSWhitespace(r) || r == '\u200B'
}

// isLineTerminator reports whether the rune ends a line for the `.` pattern.
func isLineTerminator(r rune) bool {
	return r == '\n' || r == '\r' || r == '\u2028' || r == '\u2029'
}

// isJSWhitespace reports whether the rune is whitespace in JavaScript.
func isJSWhitespace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff':
		return true
	}
	return r >= '\u2000' && r <= '\u200a'
}

// trimEndJS removes trailing JavaScript whitespace.
func trimEndJS(str string) string {
	return strings.TrimRightFunc(str, isJSWhitespace)
}

// displayWidth returns the length of the string in UTF-16 code units, which is
// what JavaScript's String.length reports.
func displayWidth(str string) int {
	width := 0
	for _, r := range str {
		if r > 0xFFFF {
			width += 2
			continue
		}
		width++
	}
	return width
}

// padEnd pads the string with spaces up to the given width (UTF-16 units).
func padEnd(str string, width int) string {
	padding := width - displayWidth(str)
	if padding <= 0 {
		return str
	}
	return str + strings.Repeat(" ", padding)
}

// jsonStringify renders a value the way JSON.stringify does for the simple
// types used by the help output.
func jsonStringify(value any) string {
	switch v := value.(type) {
	case string:
		return strconv.Quote(v)
	case bool:
		return strconv.FormatBool(v)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case float64:
		return strconv.FormatFloat(v, 'g', -1, 64)
	default:
		return strconv.Quote(fmt.Sprintf("%v", value))
	}
}

// isBooleanValue reports whether the value is a boolean.
func isBooleanValue(value any) bool {
	_, ok := value.(bool)
	return ok
}
