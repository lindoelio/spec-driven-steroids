package stewardship

import (
	"fmt"
	"strings"
)

// CLIOptions holds the options of a stewardship subcommand.
type CLIOptions struct {
	Domain     *string
	Scope      *string
	Global     bool
	Content    *string
	Author     *string
	RuleID     *string
	OnConflict *string
}

// CLIOutcome is the result of a stewardship command line invocation.
type CLIOutcome struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

// ValidPhases are the spec phases the inject command accepts.
var ValidPhases = []string{"requirements", "design", "tasks", "implementation"}

// ValidManageActions are the actions the manage command accepts.
var ValidManageActions = []string{"list", "deprecate", "archive", "move"}

// cliWriter collects the standard and the error output of a command.
type cliWriter struct {
	stdout strings.Builder
	stderr strings.Builder
}

func (w *cliWriter) out(format string, args ...any) {
	fmt.Fprintf(&w.stdout, format+"\n", args...)
}

func (w *cliWriter) err(format string, args ...any) {
	fmt.Fprintf(&w.stderr, format+"\n", args...)
}

// RunCLI runs a stewardship subcommand and returns its output and exit code.
//
// It mirrors the command layer of the TypeScript implementation, including the
// validation messages and the exit code contract.
func RunCLI(command string, args []string, opts CLIOptions) CLIOutcome {
	writer := &cliWriter{}

	switch command {
	case CommandCapabilities:
		result, err := runOrchestrator(command, nil)
		if err != nil {
			writer.err("Fatal CLI error: Error: %v", err)
			return writer.outcome(1)
		}
		writer.out("%s", result.Output)
		return writer.outcome()

	case CommandRetrieve:
		if missing := requireArgument(command, args, 0, "query"); missing != "" {
			writer.err("error: missing required argument '%s'", missing)
			return writer.outcome(1)
		}
		if opts.Domain != nil && !IsStandardDomain(*opts.Domain) {
			writer.err("Warning: '%s' is not a standard domain.", *opts.Domain)
		}
		result, err := runOrchestrator(command, RetrieveArgs{
			Query:  args[0],
			Domain: opts.Domain,
			Scope:  opts.Scope,
			Global: opts.Global,
		})
		if err != nil {
			writer.err("Fatal CLI error: Error: %v", err)
			return writer.outcome(1)
		}
		writer.out("%s", result.Output)
		return writer.outcome()

	case CommandStore:
		if missing := requireArgument(command, args, 0, "domain"); missing != "" {
			writer.err("error: missing required argument '%s'", missing)
			return writer.outcome(1)
		}
		if opts.Content == nil || *opts.Content == "" {
			writer.err("Error: --content is required for store command.")
			return writer.outcome(1)
		}
		if opts.OnConflict != nil && !isConflictDecision(*opts.OnConflict) {
			writer.err("Error: --on-conflict must be one of: cancel, override, merge.")
			return writer.outcome(1)
		}
		if !IsStandardDomain(args[0]) {
			writer.err("Warning: '%s' is not a standard domain. Custom domains are allowed.", args[0])
		}
		var decision *ConflictDecision
		if opts.OnConflict != nil {
			value := ConflictDecision(*opts.OnConflict)
			decision = &value
		}
		result, err := runOrchestrator(command, StoreArgs{
			Domain:     args[0],
			Content:    *opts.Content,
			Author:     opts.Author,
			Scope:      opts.Scope,
			Global:     opts.Global,
			OnConflict: decision,
		})
		if err != nil {
			writer.err("Fatal CLI error: Error: %v", err)
			return writer.outcome(1)
		}
		writer.out("%s", result.Output)
		if !result.Success {
			return writer.outcome(1)
		}
		return writer.outcome()

	case CommandExtract:
		if missing := requireArgument(command, args, 0, "filePath"); missing != "" {
			writer.err("error: missing required argument '%s'", missing)
			return writer.outcome(1)
		}
		result, err := runOrchestrator(command, ExtractArgs{FilePath: args[0], Author: opts.Author})
		if err != nil {
			writer.err("Fatal CLI error: Error: %v", err)
			return writer.outcome(1)
		}
		writer.out("%s", result.Output)
		candidates, ok := result.Data.([]ExtractionCandidate)
		if ok && len(candidates) > 0 {
			writer.out("\nCandidates:")
			for _, candidate := range candidates {
				confidence := ""
				if candidate.Confidence != 0 {
					confidence = fmt.Sprintf("(confidence: %s) ", jsToFixed(candidate.Confidence, 2))
				}
				writer.out("  [%s] %s%s", candidate.Domain, confidence, candidate.Content)
			}
		}
		return writer.outcome()

	case CommandTrace:
		if missing := requireArgument(command, args, 0, "ruleId"); missing != "" {
			writer.err("error: missing required argument '%s'", missing)
			return writer.outcome(1)
		}
		result, err := runOrchestrator(command, TraceArgs{
			RuleID: args[0],
			Scope:  opts.Scope,
			Global: opts.Global,
		})
		if err != nil {
			writer.err("Fatal CLI error: Error: %v", err)
			return writer.outcome(1)
		}
		writer.out("%s", result.Output)
		if !result.Success {
			return writer.outcome(1)
		}
		return writer.outcome()

	case CommandInject:
		if missing := requireArgument(command, args, 0, "phase"); missing != "" {
			writer.err("error: missing required argument '%s'", missing)
			return writer.outcome(1)
		}
		if !containsString(ValidPhases, args[0]) {
			writer.err("Error: Invalid phase '%s'. Must be one of: %s", args[0], strings.Join(ValidPhases, ", "))
			return writer.outcome(1)
		}
		result, err := runOrchestrator(command, InjectArgs{
			Phase:  args[0],
			Scope:  opts.Scope,
			Global: opts.Global,
		})
		if err != nil {
			writer.err("Fatal CLI error: Error: %v", err)
			return writer.outcome(1)
		}
		if result.Output != "" {
			writer.out("%s", result.Output)
		} else {
			writer.out("No context found for this phase.")
		}
		return writer.outcome()

	case CommandManage:
		if missing := requireArgument(command, args, 0, "action"); missing != "" {
			writer.err("error: missing required argument '%s'", missing)
			return writer.outcome(1)
		}
		action := args[0]
		if !containsString(ValidManageActions, action) {
			writer.err("Error: Invalid action '%s'. Must be one of: %s", action, strings.Join(ValidManageActions, ", "))
			return writer.outcome(1)
		}
		if (action == "deprecate" || action == "archive" || action == "move") &&
			(opts.RuleID == nil || *opts.RuleID == "") {
			writer.err("Error: --ruleId is required for '%s' action.", action)
			return writer.outcome(1)
		}
		if action == "move" && (opts.Scope == nil || *opts.Scope == "") {
			writer.err("Error: --scope is required for 'move' action.")
			return writer.outcome(1)
		}
		if action == "move" && opts.Global {
			writer.err("Error: 'move' uses --scope as the target project and cannot be combined with --global.")
			return writer.outcome(1)
		}
		result, err := runOrchestrator(command, ManageArgs{
			Action: action,
			RuleID: opts.RuleID,
			Scope:  opts.Scope,
			Global: opts.Global,
		})
		if err != nil {
			writer.err("Fatal CLI error: Error: %v", err)
			return writer.outcome(1)
		}
		writer.out("%s", result.Output)
		if !result.Success {
			return writer.outcome(1)
		}
		return writer.outcome()
	}

	writer.err("error: unknown command '%s'", command)
	return writer.outcome(1)
}

// outcome returns the collected output of a command.
func (w *cliWriter) outcome(exitCode ...int) CLIOutcome {
	code := 0
	if len(exitCode) > 0 {
		code = exitCode[0]
	}
	return CLIOutcome{Stdout: w.stdout.String(), Stderr: w.stderr.String(), ExitCode: code}
}

// requireArgument reports the name of a missing required argument.
func requireArgument(command string, args []string, index int, name string) string {
	if len(args) > index {
		return ""
	}
	return name
}

// runOrchestrator runs a command on a fresh orchestrator.
func runOrchestrator(command string, args any) (*CommandResult, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return nil, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return nil, err
	}
	return orchestrator.ExecuteCommand(command, args)
}

// isConflictDecision reports whether a value is a supported conflict decision.
func isConflictDecision(value string) bool {
	switch ConflictDecision(value) {
	case ConflictCancel, ConflictOverride, ConflictMerge:
		return true
	default:
		return false
	}
}

// containsString reports whether a list contains a value.
func containsString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
