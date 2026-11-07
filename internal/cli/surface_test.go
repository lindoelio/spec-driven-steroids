package cli

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
)

// fixtureDirectory holds the captured command surface.
const fixtureDirectory = "../testdata/fixtures/command-surface"

// TestTheCommandSurfaceMatchesTheCapturedContract checks the help output of
// every command against the captured fixtures.
//
// The previous release's contract is the baseline: every command it exposed
// keeps its name, its argument names and its help output. The package command
// is the only addition, and the root help records it.
func TestTheCommandSurfaceMatchesTheCapturedContract(t *testing.T) {
	cases := []struct {
		arguments []string
		fixture   string
	}{
		{arguments: []string{"inject"}, fixture: "help-inject.txt"},
		{arguments: []string{"clean"}, fixture: "help-clean.txt"},
		{arguments: []string{"doctor"}, fixture: "help-doctor.txt"},
		{arguments: []string{"repair"}, fixture: "help-repair.txt"},
		{arguments: []string{"uninstall"}, fixture: "help-uninstall.txt"},
		{arguments: []string{"templates"}, fixture: "help-templates.txt"},
		{arguments: []string{"validate"}, fixture: "help-validate.txt"},
		{arguments: []string{"stewardship"}, fixture: "help-stewardship.txt"},
		{arguments: []string{"package"}, fixture: "help-package.txt"},
	}

	for _, test := range cases {
		t.Run(test.fixture, func(t *testing.T) {
			expected, err := os.ReadFile(filepath.Join(fixtureDirectory, test.fixture))
			if err != nil {
				t.Fatalf("the captured fixture is not available: %v", err)
			}
			program := NewProgram()
			var written strings.Builder
			program.SetOut(&written)
			program.SetErr(&written)

			arguments := append([]string{}, test.arguments...)
			arguments = append(arguments, "--help")
			if err := program.Parse(arguments); err != nil {
				t.Fatalf("parse: %v", err)
			}
			if written.String() != string(expected) {
				t.Errorf("the help output differs:\n--- expected ---\n%s\n--- actual ---\n%s", expected, written.String())
			}
		})
	}
}

// TestTheRootHelpKeepsThePreviousCommands checks that the root help still
// lists every command of the previous release.
func TestTheRootHelpKeepsThePreviousCommands(t *testing.T) {
	program := NewProgram()
	help := program.HelpString()

	previous, err := os.ReadFile(filepath.Join(fixtureDirectory, "help-root.txt"))
	if err != nil {
		t.Fatalf("the captured fixture is not available: %v", err)
	}

	// The commands are compared line by line: a word that only appears in a
	// description does not prove that the command is listed.
	listed := map[string]bool{}
	for _, line := range strings.Split(help, "\n") {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "  ") || strings.HasPrefix(trimmed, "   ") {
			continue
		}
		name := strings.Fields(trimmed)[0]
		if name == "Usage:" || name == "Options:" || name == "Commands:" {
			continue
		}
		listed[name] = true
	}

	for _, line := range strings.Split(string(previous), "\n") {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "  ") || strings.HasPrefix(trimmed, "   ") {
			continue
		}
		name := strings.Fields(trimmed)[0]
		if name == "Usage:" || name == "Options:" || name == "Commands:" {
			continue
		}
		if !listed[name] {
			t.Errorf("the root help does not list the command %q", name)
		}
	}
}

// TestTheExitCodePolicyIsCentralized checks that the three outcomes are
// distinguishable.
func TestTheExitCodePolicyIsCentralized(t *testing.T) {
	if !cmdr.IsUsageError(cmdr.NewUsageError("boom")) {
		t.Error("a usage error is not recognized")
	}
	if cmdr.IsUsageError(nil) {
		t.Error("a nil error is recognized as a usage error")
	}
}

// TestTheExitCodeDoesNotLeakBetweenInvocations checks that the exit code of
// one invocation does not reach the next.
//
// The exit code policy is centralized, and a program that runs two commands
// in one process has to report the outcome of each of them.
func TestTheExitCodeDoesNotLeakBetweenInvocations(t *testing.T) {
	if code := Run([]string{"templates", "bogus-action"}); code != 2 {
		t.Fatalf("the first invocation returned %d, want 2", code)
	}
	if code := Run([]string{"--version"}); code != 0 {
		t.Errorf("the second invocation returned %d, want 0: the exit code leaked", code)
	}
}

// TestTheCapturedFailuresMatchTheContract checks that the failure output and
// the exit code of the previous release are preserved.
//
// The fixtures record what the previous release printed and the code it
// exited with. A test that hardcodes the same strings proves nothing: the
// captured bytes are the contract.
func TestTheCapturedFailuresMatchTheContract(t *testing.T) {
	cases := []struct {
		arguments []string
		fixture   string
	}{
		{arguments: []string{"bogus-cmd"}, fixture: "err-unknown-command.txt"},
		{arguments: []string{"inject", "--bogus"}, fixture: "err-unknown-option.txt"},
		{arguments: []string{"inject", "--platform", "bogus", "--yes"}, fixture: "err-unknown-platform.txt"},
		{arguments: []string{"--version"}, fixture: "version.txt"},
	}

	for _, test := range cases {
		t.Run(test.fixture, func(t *testing.T) {
			expected, err := os.ReadFile(filepath.Join(fixtureDirectory, test.fixture))
			if err != nil {
				t.Fatalf("the captured fixture is not available: %v", err)
			}

			output, code := runCapturing(test.arguments)
			actual := fmt.Sprintf("%sexit=%d\n", output, code)
			if actual != string(expected) {
				t.Errorf("the output differs:\n--- expected ---\n%s\n--- actual ---\n%s", expected, actual)
			}
		})
	}
}

// runCapturing runs the command with both streams captured and returns what
// they carried together with the exit code.
func runCapturing(arguments []string) (string, int) {
	reader, writer, err := os.Pipe()
	if err != nil {
		return "", -1
	}

	originalOut := os.Stdout
	originalErr := os.Stderr
	os.Stdout = writer
	os.Stderr = writer

	captured := make(chan string, 1)
	go func() {
		data, _ := io.ReadAll(reader)
		captured <- string(data)
	}()

	code := Run(arguments)

	os.Stdout = originalOut
	os.Stderr = originalErr
	_ = writer.Close()
	output := <-captured
	_ = reader.Close()

	return output, code
}
