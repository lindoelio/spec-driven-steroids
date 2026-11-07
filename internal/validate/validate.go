// Package validate ports the spec validators of the previous TypeScript
// release to Go. The diagnostics, the verdicts and the exit codes are the
// contract of the port: the same invalid input has to produce the same
// verdict, the same diagnostic text and the same exit code.
package validate

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

// Issue is a single validation error or warning.
type Issue = shared.Issue

// Result is the outcome of a validation run.
type Result struct {
	// Valid is true when there are no error-severity issues.
	Valid bool
	// Errors and Warnings hold the issues in the order the oracle emits them.
	Errors   []Issue
	Warnings []Issue
	// Lane is the detected lane ("full", "brief", ...) when the validator
	// detects one, "" otherwise.
	Lane string
	// Extra carries the additional machine-readable fields of the oracle
	// payload, such as the traceability report of `validate spec` or the
	// per-spec summary of `validate all`.
	Extra map[string]any

	// notes holds the stderr lines the command emits before its payload.
	notes []string
	// fields keeps the JSON key order of the extra payload.
	fields []shared.Field
	// raw replaces the whole payload when a command has a custom shape.
	raw *shared.Object
}

// Output is the rendered result of a validation run.
type Output struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

// CLIError is a usage or IO failure that the CLI has to report on stderr.
type CLIError struct {
	// Message is the stderr line, already prefixed the way the oracle
	// prefixes it.
	Message string
	// Code is the exit code of the command.
	Code int
	// Stdout carries an optional payload that replaces the stderr message,
	// used by `validate all --format json`.
	Stdout string
	// Notes are additional stderr lines emitted before the payload.
	Notes []string
}

// Error implements the error interface.
func (e *CLIError) Error() string {
	return e.Message
}

// set records an extra payload field, keeping the JSON key order.
func (r *Result) set(key string, value any) *Result {
	r.fields = append(r.fields, shared.Field{Key: key, Value: value})
	if r.Extra == nil {
		r.Extra = map[string]any{}
	}
	r.Extra[key] = value
	return r
}

// setRaw replaces the payload of the result with an ordered object.
func (r *Result) setRaw(object *shared.Object) *Result {
	r.raw = object
	if r.Extra == nil {
		r.Extra = map[string]any{}
	}
	for _, key := range object.Keys() {
		value, _ := object.Get(key)
		r.Extra[key] = value
	}
	return r
}

// MarshalJSON renders the result with the key order of the oracle payload.
func (r Result) MarshalJSON() ([]byte, error) {
	if r.raw != nil {
		return []byte(shared.MarshalJSON(r.raw)), nil
	}
	object := shared.NewObject()
	object.Set("valid", r.Valid)
	object.Set("errors", r.Errors)
	object.Set("warnings", r.Warnings)
	for _, field := range r.fields {
		object.Set(field.Key, field.Value)
	}
	return []byte(shared.MarshalJSON(object)), nil
}

func (r *Result) extraString(key string) string {
	if r.Extra == nil {
		return ""
	}
	value, ok := r.Extra[key].(string)
	if !ok {
		return ""
	}
	return value
}

func (r *Result) extraStrings(key string) []string {
	if r.Extra == nil {
		return nil
	}
	switch typed := r.Extra[key].(type) {
	case []string:
		return typed
	case []any:
		values := make([]string, 0, len(typed))
		for _, item := range typed {
			values = append(values, fmt.Sprintf("%v", item))
		}
		return values
	default:
		return nil
	}
}

func (r *Result) extraObjects(key string) []*shared.Object {
	if r.Extra == nil {
		return nil
	}
	switch typed := r.Extra[key].(type) {
	case []*shared.Object:
		return typed
	case []any:
		values := make([]*shared.Object, 0, len(typed))
		for _, item := range typed {
			if object, ok := item.(*shared.Object); ok {
				values = append(values, object)
			}
		}
		return values
	default:
		return nil
	}
}

func (r *Result) extraInt(key string) int {
	if r.Extra == nil {
		return 0
	}
	switch typed := r.Extra[key].(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}

func (r *Result) extraBool(key string) bool {
	if r.Extra == nil {
		return false
	}
	value, ok := r.Extra[key].(bool)
	return ok && value
}

// Options carries the options of a validate sub-command.
type Options struct {
	// TargetDir is the project root directory.
	TargetDir string
	// Requirements is the path of a requirements document.
	Requirements string
	// Design is the path of a design document.
	Design string
	// Changed is the git ref the aggregate validator compares against.
	Changed string
	// Format is "text" or "json".
	Format string
}

// Run dispatches to the sub-validator.
//
// subcommand is one of structure, brief, requirements, design, tasks, spec or
// all. args carries the arguments of the sub-command, including its options
// (for example "--requirements", "requirements.md"). format is "text" or
// "json".
func Run(subcommand string, args []string, format string) (Result, error) {
	positional, flags := parseArgs(args, "target-dir", "requirements", "design", "changed")

	options := Options{
		TargetDir:    flags["target-dir"],
		Requirements: flags["requirements"],
		Design:       flags["design"],
		Changed:      flags["changed"],
		Format:       format,
	}

	return runSubcommand(subcommand, positional, options)
}

// Execute runs a validate sub-command, writes its output and returns the
// exit code of the command.
func Execute(subcommand string, args []string, options Options, stdout io.Writer, stderr io.Writer) int {
	format := options.Format
	if format == "" {
		format = "text"
	}

	result, err := runSubcommand(subcommand, args, options)
	output := Render(subcommand, &result, format, err)

	io.WriteString(stdout, output.Stdout)
	io.WriteString(stderr, output.Stderr)

	return output.ExitCode
}

// runSubcommand dispatches to the sub-validator with the resolved options.
func runSubcommand(subcommand string, positional []string, options Options) (Result, error) {
	targetDir := options.TargetDir
	if targetDir == "" {
		targetDir = workingDirectory()
	}

	switch subcommand {
	case "structure":
		if len(positional) == 0 {
			return Result{}, &CLIError{Message: "error: missing required argument 'slug'", Code: 1}
		}
		return ValidateStructure(positional[0], targetDir)

	case "brief":
		if len(positional) == 0 {
			return Result{}, &CLIError{Message: "error: missing required argument 'path'", Code: 1}
		}
		return ValidateBrief(positional[0])

	case "requirements":
		if len(positional) == 0 {
			return Result{}, &CLIError{Message: "error: missing required argument 'path'", Code: 1}
		}
		return ValidateRequirements(positional[0])

	case "design":
		if len(positional) == 0 {
			return Result{}, &CLIError{Message: "error: missing required argument 'path'", Code: 1}
		}
		return ValidateDesign(positional[0], options.Requirements)

	case "tasks":
		if len(positional) == 0 {
			return Result{}, &CLIError{Message: "error: missing required argument 'path'", Code: 1}
		}
		return ValidateTasks(positional[0], options.Design, options.Requirements)

	case "spec":
		if len(positional) == 0 {
			return Result{}, &CLIError{Message: "error: missing required argument 'slug'", Code: 1}
		}
		return ValidateSpec(positional[0], targetDir)

	case "all":
		return ValidateAll(targetDir, options.Changed)

	default:
		return Result{}, &CLIError{Message: "error: unknown command '" + subcommand + "'", Code: 1}
	}
}

// Render renders the result of a validation run the way the oracle prints it.
// The returned output carries the stdout text, the stderr text and the exit
// code of the command.
func Render(subcommand string, result *Result, format string, err error) Output {
	if err != nil {
		var cliError *CLIError
		if asCLIError(err, &cliError) {
			notes := make([]string, 0, len(cliError.Notes))
			for _, note := range cliError.Notes {
				notes = append(notes, yellow(note)+"\n")
			}
			stderr := strings.Join(notes, "")
			if cliError.Message != "" {
				stderr += errorMessage(cliError.Message) + "\n"
			}
			output := Output{Stderr: stderr, ExitCode: cliError.Code}
			if format == "json" && cliError.Stdout != "" {
				output.Stdout = cliError.Stdout
				output.Stderr = strings.Join(notes, "")
			}
			return output
		}
		return Output{Stderr: err.Error() + "\n", ExitCode: 1}
	}

	output := renderResult(subcommand, result, format)
	if len(result.notes) > 0 {
		notes := make([]string, 0, len(result.notes))
		for _, note := range result.notes {
			notes = append(notes, yellow(note)+"\n")
		}
		output.Stderr = strings.Join(notes, "") + output.Stderr
	}
	return output
}

// errorMessage renders a failure message. The messages of the oracle that
// start with "Error: " are colored, the usage messages of the command
// framework are not.
func errorMessage(message string) string {
	if strings.HasPrefix(message, "Error: ") {
		return red(message)
	}
	return message
}

// renderResult renders the payload of a validation run.
func renderResult(subcommand string, result *Result, format string) Output {
	switch subcommand {
	case "structure":
		return renderStructure(result, format)
	case "brief":
		return renderBrief(result, format)
	case "requirements":
		return renderRequirements(result, format)
	case "design":
		return renderDesign(result, format)
	case "tasks":
		return renderTasks(result, format)
	case "spec":
		return renderSpec(result, format)
	case "all":
		return renderAll(result, format)
	default:
		return Output{ExitCode: 1}
	}
}

// jsonPayload renders the result as the JSON payload of the oracle.
func jsonPayload(result *Result) string {
	return string(mustMarshal(result))
}

func mustMarshal(result *Result) []byte {
	payload, err := result.MarshalJSON()
	if err != nil {
		return []byte("null")
	}
	return payload
}

// parseArgs splits the arguments of a sub-command into positional arguments
// and option values. The listed options take a value, every other option is
// a flag.
func parseArgs(args []string, valueOptions ...string) ([]string, map[string]string) {
	takesValue := map[string]bool{}
	for _, option := range valueOptions {
		takesValue[option] = true
	}

	positional := make([]string, 0, 2)
	options := map[string]string{}

	for index := 0; index < len(args); index++ {
		argument := args[index]
		if !strings.HasPrefix(argument, "--") {
			positional = append(positional, argument)
			continue
		}

		name := strings.TrimPrefix(argument, "--")
		value := ""
		if equals := strings.Index(name, "="); equals >= 0 {
			value = name[equals+1:]
			name = name[:equals]
		} else if takesValue[name] && index+1 < len(args) {
			index++
			value = args[index]
		}
		options[name] = value
	}

	return positional, options
}

func flagOr(options map[string]string, name string, fallback string) string {
	if value, ok := options[name]; ok && value != "" {
		return value
	}
	return fallback
}

// WorkingDirectory returns the current working directory the way the Node.js
// runtime reports it: the physical path, without symbolic links.
func WorkingDirectory() string {
	return workingDirectory()
}

// workingDirectory returns the current working directory the way Node.js
// reports it: the physical path, without symbolic links.
func workingDirectory() string {
	if directory, err := syscall.Getwd(); err == nil {
		return directory
	}
	if directory, err := os.Getwd(); err == nil {
		return directory
	}
	return "."
}

// resolvePath resolves a path against the current working directory the way
// Node.js resolves it.
func resolvePath(path string) string {
	if path == "" {
		return workingDirectory()
	}
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	return filepath.Clean(filepath.Join(workingDirectory(), path))
}

// readFileContent reads a UTF-8 file. Invalid byte sequences are replaced the
// way Node.js replaces them while decoding.
func readFileContent(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.ToValidUTF8(string(data), "�"), nil
}

// nodeErrorMessage renders a file system error the way Node.js renders it.
func nodeErrorMessage(err error, path string) string {
	switch {
	case os.IsNotExist(err):
		return "ENOENT: no such file or directory, open '" + path + "'"
	case os.IsPermission(err):
		return "EACCES: permission denied, open '" + path + "'"
	}

	var pathError *os.PathError
	if ok := asPathError(err, &pathError); ok {
		switch pathError.Err.Error() {
		case "is a directory":
			return "EISDIR: illegal operation on a directory, read"
		case "not a directory":
			return "ENOTDIR: not a directory, open '" + path + "'"
		}
	}

	return "EIO: i/o error, open '" + path + "'"
}

func asPathError(err error, target **os.PathError) bool {
	pathError, ok := err.(*os.PathError)
	if ok {
		*target = pathError
	}
	return ok
}

func asCLIError(err error, target **CLIError) bool {
	cliError, ok := err.(*CLIError)
	if ok {
		*target = cliError
	}
	return ok
}
