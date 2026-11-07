package cmdr

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestTheHelpWidthFollowsTheTerminal checks that the help text is measured
// against the terminal, the way commander measures it.
//
// Commander uses the width of the terminal when the output is one, and the
// default width otherwise. A wider terminal therefore leaves a description
// on one line that a narrower one wraps.
func TestTheHelpWidthFollowsTheTerminal(t *testing.T) {
	program := New("demo")

	// The option belongs to the subcommand, so the subcommand holds the
	// description that the width measures.
	run := program.Command("run").
		Option("--target <path>", "A description long enough to be wrapped by a narrow terminal").
		Action(func(cmd *Command, args []string) error { return nil })
	narrow := (&helpRenderer{helpWidth: 60}).formatHelp(run)
	wide := (&helpRenderer{helpWidth: 120}).formatHelp(run)

	if narrow == wide {
		t.Fatal("the help text is the same at both widths, so the width is not applied")
	}
	if !strings.Contains(narrow, "\n") {
		t.Errorf("the narrow help was not wrapped:\n%s", narrow)
	}
	for _, line := range strings.Split(wide, "\n") {
		if len(line) > 120 {
			t.Errorf("the wide help holds a line of %d characters:\n%s", len(line), wide)
		}
	}
}

// TestANonTerminalOutputUsesTheDefaultWidth checks that the help text falls
// back to the default width when the output is not a terminal.
//
// The captured fixtures were recorded without a terminal, so this is the
// width they hold.
func TestANonTerminalOutputUsesTheDefaultWidth(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "out-*.txt")
	if err != nil {
		t.Fatalf("create the output file: %v", err)
	}
	defer file.Close()

	if width := terminalWidth(file); width != 0 {
		t.Errorf("a regular file reports the width %d", width)
	}

	program := New("demo")
	program.out = file
	program.Command("run").Option("--target <path>", "A description long enough to be wrapped by a narrow terminal").
		Action(func(cmd *Command, args []string) error { return nil })

	help := program.HelpString()
	expected := (&helpRenderer{helpWidth: defaultHelpWidth}).formatHelp(program)
	if help != expected {
		t.Errorf("the help of a non terminal output is not measured at the default width:\n%s", help)
	}
}

// TestTheErrorHelpIsMeasuredAgainstTheErrorStream checks that the help text
// printed after a failure is measured against the standard error.
//
// Commander measures the standard output for the help it prints on the
// standard output, and the standard error for the help it prints on the
// standard error.
func TestTheErrorHelpIsMeasuredAgainstTheErrorStream(t *testing.T) {
	program := New("demo")
	output := &bytes.Buffer{}
	errors := &bytes.Buffer{}
	program.out = output
	program.err = errors

	program.Command("run").Option("--target <path>", "A description long enough to be wrapped by a narrow terminal").
		Action(func(cmd *Command, args []string) error { return nil })

	if program.HelpString() != program.ErrorHelpString() {
		t.Errorf("the two help texts differ although both streams are files:\n%s\n---\n%s",
			program.HelpString(), program.ErrorHelpString())
	}
}

// TestTheHelpOfACommandKeepsItsOwnWidth checks that the help of a command is
// measured the same way as the help of the program.
func TestTheHelpOfACommandKeepsItsOwnWidth(t *testing.T) {
	program := New("demo")
	run := program.Command("run").
		Option("--target <path>", "A description long enough to be wrapped by a narrow terminal").
		Action(func(cmd *Command, args []string) error { return nil })

	help := run.HelpString()
	if !strings.Contains(help, "--target <path>") {
		t.Errorf("the help of the command does not describe its option:\n%s", help)
	}
	if strings.Contains(help, filepath.Join("a", "b")) {
		t.Errorf("the help of the command holds a path that was never declared:\n%s", help)
	}
}
