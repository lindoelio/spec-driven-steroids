package cli

import (
	"os"

	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
	"github.com/lindoelio/spec-driven-steroids/internal/stewardship"
)

// stewardshipDescription is the help text of the stewardship command.
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

// NewStewardshipCommand creates the stewardship command.
func NewStewardshipCommand() *cmdr.Command {
	cmd := cmdr.New("stewardship").
		Description(stewardshipDescription)

	cmd.AddCommand(newStewardshipCapabilitiesCommand())
	cmd.AddCommand(newStewardshipRetrieveCommand())
	cmd.AddCommand(newStewardshipStoreCommand())
	cmd.AddCommand(newStewardshipExtractCommand())
	cmd.AddCommand(newStewardshipTraceCommand())
	cmd.AddCommand(newStewardshipInjectCommand())
	cmd.AddCommand(newStewardshipManageCommand())

	return cmd
}

func newStewardshipCapabilitiesCommand() *cmdr.Command {
	return cmdr.New("capabilities").
		Description("Report available stewardship capabilities").
		Action(func(cmd *cmdr.Command, args []string) error {
			return runStewardship(stewardship.CommandCapabilities, nil, stewardship.CLIOptions{})
		})
}

func newStewardshipRetrieveCommand() *cmdr.Command {
	return cmdr.New("retrieve").
		Description("Search for rules in the knowledge graph").
		Argument("<query>", "Search query text").
		AllowExcessArguments(true).
		Option("--domain <domain>", "Filter by domain (architecture, business, workflow, security, performance, legal, team-structure, technical-debt)").
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Search only global stewardship rules").
		Action(func(cmd *cmdr.Command, args []string) error {
			options := stewardship.CLIOptions{
				Domain: optionalString(cmd.OptString("domain")),
				Scope:  optionalString(cmd.OptString("scope")),
				Global: cmd.OptBool("global"),
			}
			return runStewardship(stewardship.CommandRetrieve, args, options)
		})
}

func newStewardshipStoreCommand() *cmdr.Command {
	return cmdr.New("store").
		Description("Persist a new rule to the knowledge graph").
		Argument("<domain>", "Rule domain (architecture, business, workflow, security, performance, legal, team-structure, technical-debt)").
		AllowExcessArguments(true).
		Option("--content <content>", "Rule content text").
		Option("--author <author>", "Author name").
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Persist as a global rule instead of a project rule").
		Option("--on-conflict <decision>", "Resolve conflicts with cancel, override, or merge").
		Action(func(cmd *cmdr.Command, args []string) error {
			options := stewardship.CLIOptions{
				Content:    optionalString(cmd.OptString("content")),
				Author:     optionalString(cmd.OptString("author")),
				Scope:      optionalString(cmd.OptString("scope")),
				Global:     cmd.OptBool("global"),
				OnConflict: optionalString(cmd.OptString("on-conflict")),
			}
			return runStewardship(stewardship.CommandStore, args, options)
		})
}

func newStewardshipExtractCommand() *cmdr.Command {
	return cmdr.New("extract").
		Description("Extract decision candidates from a design.md or requirements.md file").
		Argument("<filePath>", "Path to the spec file").
		AllowExcessArguments(true).
		Option("--author <author>", "Author name for provenance").
		Action(func(cmd *cmdr.Command, args []string) error {
			options := stewardship.CLIOptions{Author: optionalString(cmd.OptString("author"))}
			return runStewardship(stewardship.CommandExtract, args, options)
		})
}

func newStewardshipTraceCommand() *cmdr.Command {
	return cmdr.New("trace").
		Description("Show full provenance and version history for a rule").
		Argument("<ruleId>", "Rule identifier").
		AllowExcessArguments(true).
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Trace only the global rule store").
		Action(func(cmd *cmdr.Command, args []string) error {
			options := stewardship.CLIOptions{
				Scope:  optionalString(cmd.OptString("scope")),
				Global: cmd.OptBool("global"),
			}
			return runStewardship(stewardship.CommandTrace, args, options)
		})
}

func newStewardshipInjectCommand() *cmdr.Command {
	return cmdr.New("inject").
		Description("Retrieve and format relevant context for a spec phase").
		Argument("<phase>", "Spec phase: requirements, design, tasks, or implementation").
		AllowExcessArguments(true).
		Option("--scope <scope>", "Project scope identifier (defaults to current project)").
		Option("--global", "Inject only global stewardship context").
		Action(func(cmd *cmdr.Command, args []string) error {
			options := stewardship.CLIOptions{
				Scope:  optionalString(cmd.OptString("scope")),
				Global: cmd.OptBool("global"),
			}
			return runStewardship(stewardship.CommandInject, args, options)
		})
}

func newStewardshipManageCommand() *cmdr.Command {
	return cmdr.New("manage").
		Description("List, deprecate, archive, or move rules").
		Argument("<action>", "Action: list, deprecate, archive, or move").
		AllowExcessArguments(true).
		Option("--ruleId <ruleId>", "Rule identifier (required for deprecate, archive, and move)").
		Option("--scope <scope>", "Project scope identifier (defaults to current project; required target for move)").
		Option("--global", "Manage only global rules").
		Action(func(cmd *cmdr.Command, args []string) error {
			options := stewardship.CLIOptions{
				RuleID: optionalString(cmd.OptString("ruleId")),
				Scope:  optionalString(cmd.OptString("scope")),
				Global: cmd.OptBool("global"),
			}
			return runStewardship(stewardship.CommandManage, args, options)
		})
}

// runStewardship runs a stewardship subcommand and reports its output.
func runStewardship(command string, args []string, options stewardship.CLIOptions) error {
	outcome := stewardship.RunCLI(command, args, options)
	if outcome.Stdout != "" {
		os.Stdout.WriteString(outcome.Stdout)
	}
	if outcome.Stderr != "" {
		os.Stderr.WriteString(outcome.Stderr)
	}
	if outcome.ExitCode != 0 {
		setExitCode(outcome.ExitCode)
	}
	return nil
}

// optionalString returns nil for an option that was not provided.
func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
