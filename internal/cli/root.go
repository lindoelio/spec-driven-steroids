// Package cli wires the command surface of the product.
//
// The commands, their argument names and their exit codes match the previous
// release. The machine readable payloads carry additive fields only.
package cli

import (
	"fmt"
	"os"

	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
	"github.com/lindoelio/spec-driven-steroids/internal/version"
)

// NewProgram builds the command tree.
func NewProgram() *cmdr.Command {
	program := cmdr.New("spec-driven-steroids")
	program.Alias("sds")
	program.Description("Inject Spec-Driven standards into your repository")
	program.Version(version.String())

	program.AddCommand(NewValidateCommand())
	program.AddCommand(NewStewardshipCommand())
	program.AddCommand(NewDoctorCommand())
	program.AddCommand(NewRepairCommand())
	program.AddCommand(NewUninstallCommand())
	program.AddCommand(NewTemplatesCommand())

	program.AddCommand(NewInjectCommand())
	program.AddCommand(NewCleanCommand())
	program.AddCommand(NewPackageCommand())

	return program
}

// Run executes the command line and returns the process exit code.
//
// The exit code policy is centralized: zero for success, one for a failure and
// two for a request the CLI rejects as invalid usage. The exit codes of the
// previous release are preserved: a command line the framework cannot parse
// and a validation failure both exit with one, while a request the CLI
// rejects — an unknown platform, an invalid scope — exits with two.
func Run(args []string) int {
	// The exit code is the outcome of this invocation only.
	exitCode = 0

	program := NewProgram()
	if err := program.Parse(args); err != nil {
		if code, ok := reportedCode(err); ok {
			return code
		}
		if cmdr.IsUsageError(err) {
			// The framework already printed the diagnostic.
			return 1
		}
		fmt.Fprintln(os.Stderr, red("Fatal CLI error:"), err)
		return 1
	}
	return exitCode
}

// exitCode is set by a command that fails without returning an error, the way
// the previous release set process.exitCode.
var exitCode int

// setExitCode records a failing outcome.
func setExitCode(code int) { exitCode = code }
