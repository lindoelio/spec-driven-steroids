package cli

import (
	"os"

	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
	"github.com/lindoelio/spec-driven-steroids/internal/validate"
)

// NewValidateCommand creates the parent 'validate' command with all
// subcommands registered.
//
// Provides comprehensive validation for Spec-Driven specs:
// - structure: Validates spec directory structure
// - brief: Validates the lightweight approved brief format
// - requirements: Validates requirements.md EARS patterns and numbering
// - design: Validates design.md Mermaid diagrams and traceability
// - tasks: Validates tasks.md phase structure and traceability
// - spec: Validates entire spec with cross-file traceability
func NewValidateCommand() *cmdr.Command {
	cmd := cmdr.New("validate")

	cmd.Description(`Validate Spec-Driven specs for correctness and completeness.

The validate command checks specs in .specs/changes/<slug>/ for:
  • structure   - Required files for brief or full lanes
  • brief       - Compact change brief structure and traceability
  • requirements - EARS patterns, REQ-X numbering, acceptance criteria
  • design      - Mermaid diagrams, DES-X numbering, _Implements tags
  • tasks       - Phase structure, task status, traceability links
  • spec        - Cross-file validation and traceability matrix
  • all         - Aggregate every spec in .specs/changes

All subcommands support --format <text|json> for output control.
Use --help with any subcommand for specific options and examples.`)

	cmd.AddCommand(newValidateStructureCommand())
	cmd.AddCommand(newValidateBriefCommand())
	cmd.AddCommand(newValidateRequirementsCommand())
	cmd.AddCommand(newValidateDesignCommand())
	cmd.AddCommand(newValidateTasksCommand())
	cmd.AddCommand(newValidateSpecCommand())
	cmd.AddCommand(newValidateAllCommand())

	return cmd
}

// newValidateStructureCommand creates the 'structure' subcommand.
func newValidateStructureCommand() *cmdr.Command {
	cmd := cmdr.New("structure")

	cmd.Description("Validate that a spec directory contains either brief.md or the full requirements/design/tasks set")
	cmd.Argument("<slug>", "Spec slug (e.g., my-feature)")
	cmd.OptionWithDefault("--target-dir <path>", "Project root directory", validate.WorkingDirectory())
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		options := validate.Options{
			Format:    command.OptString("format"),
			TargetDir: command.OptString("target-dir"),
		}
		return runValidate("structure", args, options)
	})

	return cmd
}

// newValidateBriefCommand creates the 'brief' subcommand.
func newValidateBriefCommand() *cmdr.Command {
	cmd := cmdr.New("brief")

	cmd.Description("Validate a brief.md file for structure, bounded scope, and requirement-to-task traceability")
	cmd.Argument("<path>", "Path to brief.md file")
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		options := validate.Options{
			Format: command.OptString("format"),
		}
		return runValidate("brief", args, options)
	})

	return cmd
}

// newValidateRequirementsCommand creates the 'requirements' subcommand.
func newValidateRequirementsCommand() *cmdr.Command {
	cmd := cmdr.New("requirements")

	cmd.Description("Validate a requirements.md file for EARS patterns, REQ-X numbering, and acceptance criteria")
	cmd.Argument("<path>", "Path to requirements.md file")
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		options := validate.Options{
			Format: command.OptString("format"),
		}
		return runValidate("requirements", args, options)
	})

	return cmd
}

// newValidateDesignCommand creates the 'design' subcommand.
func newValidateDesignCommand() *cmdr.Command {
	cmd := cmdr.New("design")

	cmd.Description("Validate a design.md file for Mermaid diagrams, DES-X numbering, and traceability links")
	cmd.Argument("<path>", "Path to design.md file")
	cmd.Option("--requirements <path>", "Path to requirements.md for traceability validation")
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		options := validate.Options{
			Format:       command.OptString("format"),
			Requirements: command.OptString("requirements"),
		}
		return runValidate("design", args, options)
	})

	return cmd
}

// newValidateTasksCommand creates the 'tasks' subcommand.
func newValidateTasksCommand() *cmdr.Command {
	cmd := cmdr.New("tasks")

	cmd.Description("Validate a tasks.md file for phase structure, task checkboxes, status markers, and traceability")
	cmd.Argument("<path>", "Path to tasks.md file")
	cmd.Option("--design <path>", "Path to design.md for traceability validation")
	cmd.Option("--requirements <path>", "Path to requirements.md for acceptance-criteria validation")
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		options := validate.Options{
			Format:       command.OptString("format"),
			Design:       command.OptString("design"),
			Requirements: command.OptString("requirements"),
		}
		return runValidate("tasks", args, options)
	})

	return cmd
}

// newValidateSpecCommand creates the 'spec' subcommand.
func newValidateSpecCommand() *cmdr.Command {
	cmd := cmdr.New("spec")

	cmd.Description("Validate a brief or full spec with cross-file traceability")
	cmd.Argument("<slug>", "Spec slug (e.g., my-feature)")
	cmd.OptionWithDefault("--target-dir <path>", "Project root directory", validate.WorkingDirectory())
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		options := validate.Options{
			Format:    command.OptString("format"),
			TargetDir: command.OptString("target-dir"),
		}
		return runValidate("spec", args, options)
	})

	return cmd
}

// newValidateAllCommand creates the 'all' subcommand.
func newValidateAllCommand() *cmdr.Command {
	cmd := cmdr.New("all")

	cmd.Description("Validate all specs under .specs/changes in one aggregated result")
	cmd.OptionWithDefault("--target-dir <path>", "Project root directory", validate.WorkingDirectory())
	cmd.Option("--changed <ref>", "Only validate specs changed since a git ref")
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		options := validate.Options{
			Format:    command.OptString("format"),
			TargetDir: command.OptString("target-dir"),
			Changed:   command.OptString("changed"),
		}
		return runValidate("all", args, options)
	})

	return cmd
}

// runValidate executes a validate sub-command and reports its exit code.
//
// The validator prints its own diagnostics, so the command returns no error:
// a successful validation exits with 0, a failed one with 1 and a usage
// failure of the aggregate validator with 2.
func runValidate(subcommand string, args []string, options validate.Options) error {
	code := validate.Execute(subcommand, args, options, os.Stdout, os.Stderr)
	if code != 0 {
		setExitCode(code)
	}
	return nil
}
