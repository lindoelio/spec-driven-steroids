package cmdr

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The fixture tree below mirrors the command tree of the TypeScript oracle
// (packages/cli/src/cli/index.ts, packages/cli/src/core/validate/*,
// packages/cli/src/context-stewardship/cli-command.ts and
// packages/cli/src/commands/manifest-commands.ts). The rendered help must be
// byte identical to the captured golden files in
// internal/testdata/fixtures/command-surface/.

const validateDescription = `Validate Spec-Driven specs for correctness and completeness.

The validate command checks specs in .specs/changes/<slug>/ for:
  • structure   - Required files for brief or full lanes
  • brief       - Compact change brief structure and traceability
  • requirements - EARS patterns, REQ-X numbering, acceptance criteria
  • design      - Mermaid diagrams, DES-X numbering, _Implements tags
  • tasks       - Phase structure, task status, traceability links
  • spec        - Cross-file validation and traceability matrix
  • all         - Aggregate every spec in .specs/changes

All subcommands support --format <text|json> for output control.
Use --help with any subcommand for specific options and examples.`

const stewardshipDescription = `Manage contextual knowledge for Spec-Driven workflows.

The stewardship command stores, retrieves, and manages architectural decisions,
business rules, and workflow conventions extracted from spec files. These rules
are injected into spec-driven phases to guide agents with established patterns.

Subcommands:
  capabilities   - Report available capabilities
  retrieve       - Search for rules by query and domain
  store          - Persist a new rule
  extract        - Extract decision candidates from spec files
  trace          - Show rule provenance and version history
  inject         - Retrieve context for a spec phase
  manage         - List, deprecate, archive, or move rules

Use --help with any subcommand for specific options and examples.`

func noopAction(cmd *Command, args []string) error { return nil }

func fixtureProgram(t *testing.T) *Command {
	t.Helper()

	cwd, err := os.Getwd()
	if err != nil {
		cwd = "/tmp"
	}

	program := New("spec-driven-steroids").
		Alias("sds").
		Description("Inject Spec-Driven standards into your repository").
		Version("0.23.0")

	program.AddCommand(fixtureValidateCommand(cwd))
	program.AddCommand(fixtureStewardshipCommand())
	program.AddCommand(fixtureDoctorCommand())
	program.AddCommand(fixtureRepairCommand())
	program.AddCommand(fixtureUninstallCommand())
	program.AddCommand(fixtureTemplatesCommand())

	program.Command("inject").
		Description("Inject platform-specific Spec-Driven configs").
		Option("--platform <ids>", "Comma-separated platform IDs (skips the platform prompt)").
		Option("--scope <scope>", "Injection scope: global or project").
		Option("--templates <source>", "Template source: bundled or remote").
		Option("--dry-run", "Show planned files without writing them").
		Option("--json", "Emit a machine-readable JSON summary").
		Option("--backup", "Back up existing platform roots before writing").
		Option("--yes", "Skip prompts when --platform is provided").
		Action(noopAction)

	program.Command("clean").
		Description("Remove globally injected Spec-Driven Steroids").
		Option("--global", "Clean global steroids from all platforms (default)").
		Option("--project", "Clean project-level steroids in the current directory").
		Option("--platform <platform>", "Limit cleanup to one platform").
		Option("--force", "Remove files even if they were modified after installation").
		Option("--dry-run", "Show what would be removed without deleting anything").
		Option("--json", "Emit a machine-readable JSON summary").
		Option("-y, --yes", "Skip confirmation prompt").
		Action(noopAction)

	return program
}

func fixtureValidateCommand(cwd string) *Command {
	cmd := New("validate").Description(validateDescription)

	structure := New("structure").
		Description("Validate that a spec directory contains either brief.md or the full requirements/design/tasks set").
		Argument("<slug>", "Spec slug (e.g., my-feature)").
		OptionWithDefault("--target-dir <path>", "Project root directory", cwd).
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)

	brief := New("brief").
		Description("Validate a brief.md file for structure, bounded scope, and requirement-to-task traceability").
		Argument("<path>", "Path to brief.md file").
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)

	requirements := New("requirements").
		Description("Validate a requirements.md file for EARS patterns, REQ-X numbering, and acceptance criteria").
		Argument("<path>", "Path to requirements.md file").
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)

	design := New("design").
		Description("Validate a design.md file for Mermaid diagrams, DES-X numbering, and traceability links").
		Argument("<path>", "Path to design.md file").
		Option("--requirements <path>", "Path to requirements.md for traceability validation").
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)

	tasks := New("tasks").
		Description("Validate a tasks.md file for phase structure, task checkboxes, status markers, and traceability").
		Argument("<path>", "Path to tasks.md file").
		Option("--design <path>", "Path to design.md for traceability validation").
		Option("--requirements <path>", "Path to requirements.md for acceptance-criteria validation").
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)

	spec := New("spec").
		Description("Validate a brief or full spec with cross-file traceability").
		Argument("<slug>", "Spec slug (e.g., my-feature)").
		OptionWithDefault("--target-dir <path>", "Project root directory", cwd).
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)

	all := New("all").
		Description("Validate all specs under .specs/changes in one aggregated result").
		OptionWithDefault("--target-dir <path>", "Project root directory", cwd).
		Option("--changed <ref>", "Only validate specs changed since a git ref").
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)

	for _, sub := range []*Command{structure, brief, requirements, design, tasks, spec, all} {
		cmd.AddCommand(sub)
	}
	return cmd
}

func fixtureStewardshipCommand() *Command {
	cmd := New("stewardship").Description(stewardshipDescription)

	capabilities := New("capabilities").
		Description("Report available stewardship capabilities").
		Action(noopAction)

	retrieve := New("retrieve").
		Description("Search for rules in the knowledge graph").
		Argument("<query>", "Search query text").
		Option("--domain <domain>", "Filter by domain (architecture, business, workflow, security, performance, legal, team-structure, technical-debt)").
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Search only global stewardship rules").
		Action(noopAction)

	store := New("store").
		Description("Persist a new rule to the knowledge graph").
		Argument("<domain>", "Rule domain (architecture, business, workflow, security, performance, legal, team-structure, technical-debt)").
		Option("--content <content>", "Rule content text").
		Option("--author <author>", "Author name").
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Persist as a global rule instead of a project rule").
		Option("--on-conflict <decision>", "Resolve conflicts with cancel, override, or merge").
		Action(noopAction)

	extract := New("extract").
		Description("Extract decision candidates from a design.md or requirements.md file").
		Argument("<filePath>", "Path to the spec file").
		Option("--author <author>", "Author name for provenance").
		Action(noopAction)

	trace := New("trace").
		Description("Show full provenance and version history for a rule").
		Argument("<ruleId>", "Rule identifier").
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Trace only the global rule store").
		Action(noopAction)

	inject := New("inject").
		Description("Retrieve and format relevant context for a spec phase").
		Argument("<phase>", "Spec phase: requirements, design, tasks, or implementation").
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Inject only global stewardship context").
		Action(noopAction)

	manage := New("manage").
		Description("List, deprecate, archive, or move rules").
		Argument("<action>", "Action: list, deprecate, archive, or move").
		Option("--ruleId <ruleId>", "Rule identifier (required for deprecate, archive, and move)").
		Option("--scope <scope>", "Project scope identifier (defaults to current project; required target for move)").
		Option("--global", "Manage only global rules").
		Action(noopAction)

	for _, sub := range []*Command{capabilities, retrieve, store, extract, trace, inject, manage} {
		cmd.AddCommand(sub)
	}
	return cmd
}

func fixtureDoctorCommand() *Command {
	return New("doctor").
		Description("Check installed SDS files for missing or modified artifacts").
		OptionWithDefault("--format <text|json>", "Output format (text or json)", "text").
		Action(noopAction)
}

func fixtureRepairCommand() *Command {
	return New("repair").
		Description("Re-inject missing files for manifest-tracked installs").
		Option("--platform <platform>", "Limit to one platform").
		OptionWithDefault("--scope <scope>", "Scope: global or project", "global").
		Option("--project", "Shortcut for --scope project").
		Option("--dry-run", "Show what would be written").
		Option("--json", "Emit JSON").
		Action(noopAction)
}

func fixtureUninstallCommand() *Command {
	return New("uninstall").
		Description("Remove manifest-tracked SDS files for a platform and scope").
		Option("--platform <platform>", "Limit to one platform").
		OptionWithDefault("--scope <scope>", "Scope: global or project", "global").
		Option("--project", "Shortcut for --scope project").
		Option("--force", "Remove files even if modified").
		Option("--dry-run", "Show what would be removed").
		Option("--json", "Emit JSON").
		Option("-y, --yes", "Skip confirmation prompt").
		Action(noopAction)
}

func fixtureTemplatesCommand() *Command {
	return New("templates").
		Description("Inspect the resolved template source").
		Argument("<action>", "Action: info").
		Option("--source <source>", "Template source: bundled or remote").
		Option("--json", "Emit JSON").
		Action(noopAction)
}

// goldenDir is the directory holding the captured oracle output.
func goldenDir(t *testing.T) string {
	t.Helper()
	return filepath.Join("..", "testdata", "fixtures", "command-surface")
}

func readGolden(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(goldenDir(t), name))
	if err != nil {
		t.Fatalf("read golden %s: %v", name, err)
	}
	// A Windows checkout can turn the captured LF fixture into CRLF; the
	// renderer always writes LF.
	return strings.ReplaceAll(string(data), "\r\n", "\n")
}

// TestHelpMatchesGolden renders the help of every command of the fixture tree
// and compares it byte for byte with the captured oracle output.
func TestHelpMatchesGolden(t *testing.T) {
	program := fixtureProgram(t)

	cases := []struct {
		golden string
		lookup func(root *Command) *Command
	}{
		{"help-root.txt", func(root *Command) *Command { return root }},
		{"help-inject.txt", func(root *Command) *Command { return root.findCommand("inject") }},
		{"help-clean.txt", func(root *Command) *Command { return root.findCommand("clean") }},
		{"help-doctor.txt", func(root *Command) *Command { return root.findCommand("doctor") }},
		{"help-repair.txt", func(root *Command) *Command { return root.findCommand("repair") }},
		{"help-uninstall.txt", func(root *Command) *Command { return root.findCommand("uninstall") }},
		{"help-templates.txt", func(root *Command) *Command { return root.findCommand("templates") }},
		{"help-validate.txt", func(root *Command) *Command { return root.findCommand("validate") }},
		{"help-stewardship.txt", func(root *Command) *Command { return root.findCommand("stewardship") }},
	}

	for _, tc := range cases {
		t.Run(strings.TrimSuffix(tc.golden, ".txt"), func(t *testing.T) {
			cmd := tc.lookup(program)
			if cmd == nil {
				t.Fatalf("command for golden %s not found", tc.golden)
			}
			got := cmd.HelpString()
			want := readGolden(t, tc.golden)
			if got != want {
				t.Errorf("help output differs from %s\n--- got ---\n%s\n--- want ---\n%s", tc.golden, got, want)
			}
		})
	}
}

// TestUnknownOption checks the commander style error for an unknown option.
func TestUnknownOption(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	err := program.Parse([]string{"--bogus"})
	if err == nil {
		t.Fatal("expected an error for an unknown option")
	}
	if !IsUsageError(err) {
		t.Errorf("expected a usage error, got %T: %v", err, err)
	}
	if got, want := stderr.String(), "error: unknown option '--bogus'\n"; got != want {
		t.Errorf("stderr = %q, want %q", got, want)
	}
}

// TestUnknownCommand checks the commander style error for an unknown command.
func TestUnknownCommand(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	err := program.Parse([]string{"bogus-cmd"})
	if err == nil {
		t.Fatal("expected an error for an unknown command")
	}
	if !IsUsageError(err) {
		t.Errorf("expected a usage error, got %T: %v", err, err)
	}
	if got, want := stderr.String(), "error: unknown command 'bogus-cmd'\n"; got != want {
		t.Errorf("stderr = %q, want %q", got, want)
	}
}

// TestUnknownOptionInSubcommand checks that the error is reported by the
// subcommand that owns the option namespace.
func TestUnknownOptionInSubcommand(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	err := program.Parse([]string{"inject", "--bogus"})
	if err == nil || !IsUsageError(err) {
		t.Fatalf("expected a usage error, got %v", err)
	}
	if got, want := stderr.String(), "error: unknown option '--bogus'\n"; got != want {
		t.Errorf("stderr = %q, want %q", got, want)
	}
}

// TestVersionOutput checks the implicit version option.
func TestVersionOutput(t *testing.T) {
	program := fixtureProgram(t)
	var stdout bytes.Buffer
	program.SetOut(&stdout)

	if err := program.Parse([]string{"--version"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got, want := stdout.String(), "0.23.0\n"; got != want {
		t.Errorf("stdout = %q, want %q", got, want)
	}
}

// TestHelpFlagPrintsHelpToStdout checks the implicit help option.
func TestHelpFlagPrintsHelpToStdout(t *testing.T) {
	program := fixtureProgram(t)
	var stdout bytes.Buffer
	program.SetOut(&stdout)

	if err := program.Parse([]string{"inject", "--help"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got, want := stdout.String(), readGolden(t, "help-inject.txt"); got != want {
		t.Errorf("help output differs from the golden file")
	}
}

// TestUnknownCommandInSubcommand checks the error for an unknown subcommand
// of a nested command.
func TestUnknownCommandInSubcommand(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	err := program.Parse([]string{"validate", "bogus"})
	if err == nil || !IsUsageError(err) {
		t.Fatalf("expected a usage error, got %v", err)
	}
	if got, want := stderr.String(), "error: unknown command 'bogus'\n"; got != want {
		t.Errorf("stderr = %q, want %q", got, want)
	}
}

// TestRootHelpFlag checks that the root help is written to stdout.
func TestRootHelpFlag(t *testing.T) {
	program := fixtureProgram(t)
	var stdout bytes.Buffer
	program.SetOut(&stdout)

	if err := program.Parse([]string{"--help"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got, want := stdout.String(), readGolden(t, "help-root.txt"); got != want {
		t.Errorf("help output differs from the golden file")
	}
}

// TestImplicitHelpCommand checks the implicit "help [command]" command.
func TestImplicitHelpCommand(t *testing.T) {
	program := fixtureProgram(t)
	var stdout bytes.Buffer
	program.SetOut(&stdout)

	if err := program.Parse([]string{"help", "inject"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got, want := stdout.String(), readGolden(t, "help-inject.txt"); got != want {
		t.Errorf("help output differs from the golden file")
	}
}

// TestMissingSubcommand checks that a parent command without a subcommand
// prints its help on stderr, like commander does.
func TestMissingSubcommand(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	err := program.Parse(nil)
	if err == nil {
		t.Fatal("expected an error when no subcommand is given")
	}
	if !IsUsageError(err) {
		t.Errorf("expected a usage error, got a plain error: %v", err)
	}
	if got, want := stderr.String(), readGolden(t, "help-root.txt"); got != want {
		t.Errorf("stderr differs from the golden help output")
	}
}

// TestOptionParsing covers the supported option syntax.
func TestOptionParsing(t *testing.T) {
	program := fixtureProgram(t)
	var got []string
	program.Command("demo").
		AllowExcessArguments(true).
		Option("--dry-run", "dry run").
		Option("--platform <ids>", "platform ids").
		Option("--scope <scope>", "scope").
		Option("-y, --yes", "assume yes").
		Action(func(cmd *Command, args []string) error {
			got = append(got, cmd.OptString("platform"), cmd.OptString("scope"),
				strconvBool(cmd.OptBool("dry-run")), strconvBool(cmd.OptBool("yes")),
				strconvBool(cmd.Changed("dry-run")), strconvBool(cmd.Changed("scope")))
			return nil
		})

	err := program.Parse([]string{"demo", "--dry-run", "--platform", "a,b", "--scope=project", "-y", "extra"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{"a,b", "project", "true", "true", "true", "true"}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("value %d = %q, want %q", i, got[i], want[i])
		}
	}
}

// TestDoubleDashTerminator checks that everything after "--" is positional.
func TestDoubleDashTerminator(t *testing.T) {
	program := fixtureProgram(t)
	var got []string
	program.Command("demo").
		AllowExcessArguments(true).
		Option("--flag", "flag").
		Action(func(cmd *Command, args []string) error {
			got = cmd.Args()
			return nil
		})

	if err := program.Parse([]string{"demo", "--", "--flag", "positional"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 || got[0] != "--flag" || got[1] != "positional" {
		t.Errorf("args = %v, want [--flag positional]", got)
	}
}

// TestMissingRequiredArgument checks the usage error for a missing argument.
func TestMissingRequiredArgument(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	err := program.Parse([]string{"templates"})
	if err == nil || !IsUsageError(err) {
		t.Fatalf("expected a usage error, got %v", err)
	}
	if !strings.Contains(stderr.String(), "missing required argument 'action'") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

// TestSurplusArgumentsAreAccepted checks that surplus arguments are handed to
// the action.
//
// Commander accepts them unless a program opts out of it, and the previous
// release never opted out, so a command line that worked before still works.
func TestSurplusArgumentsAreAccepted(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	if err := program.Parse([]string{"templates", "info", "extra"}); err != nil {
		t.Fatalf("the surplus argument was refused: %v (stderr=%q)", err, stderr.String())
	}
}

// TestTooManyArgumentsWhenTheProgramOptsOut checks the usage error for
// surplus arguments in a program that opts out of them.
func TestTooManyArgumentsWhenTheProgramOptsOut(t *testing.T) {
	program := fixtureProgram(t)
	program.findCommand("templates").AllowExcessArguments(false)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	err := program.Parse([]string{"templates", "info", "extra"})
	if err == nil || !IsUsageError(err) {
		t.Fatalf("expected a usage error, got %v", err)
	}
	if !strings.Contains(stderr.String(), "too many arguments") {
		t.Errorf("stderr = %q", stderr.String())
	}
}

// TestTheDeclaredDefaultIsTheParsedValue checks that an option that was not
// given reads back as the default it declared.
func TestTheDeclaredDefaultIsTheParsedValue(t *testing.T) {
	program := New("demo")
	var observed string
	program.Command("show").
		OptionWithDefault("--format <text|json>", "Output format", "text").
		Action(func(cmd *Command, args []string) error {
			observed = cmd.OptString("format")
			return nil
		})

	if err := program.Parse([]string{"show"}); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if observed != "text" {
		t.Errorf("the option read back as %q, want %q", observed, "text")
	}
}

// TestInvalidOptionValue checks the usage error for a value outside the
// allowed choices.
func TestInvalidOptionValue(t *testing.T) {
	program := fixtureProgram(t)
	var stderr bytes.Buffer
	program.SetErr(&stderr)

	program.Command("demo").
		OptionWithChoices("--scope <scope>", "scope", []string{"global", "project"}).
		Action(noopAction)

	err := program.Parse([]string{"demo", "--scope", "bogus"})
	if err == nil || !IsUsageError(err) {
		t.Fatalf("expected a usage error, got %v", err)
	}
	want := "error: option '--scope <scope>' argument 'bogus' is invalid. Allowed choices are global, project.\n"
	if got := stderr.String(); got != want {
		t.Errorf("stderr = %q, want %q", got, want)
	}
}

func strconvBool(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
