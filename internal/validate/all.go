package validate

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

var changedSpecPathPattern = regexp.MustCompile(`^\.specs/changes/([^/]+)/`)

// specSummary is the aggregated result of one spec.
type specSummary struct {
	slug     string
	valid    bool
	lane     string
	errors   int
	warnings int
}

// specSelection is the set of specs the aggregate validator runs on.
type specSelection struct {
	slugs    []string
	filtered bool
	err      string
	warning  string
}

// ValidateAll validates every spec under .specs/changes of the target
// directory. When changedRef is set only the specs changed since that git
// ref are validated.
func ValidateAll(targetDir string, changedRef string) (Result, error) {
	selection := selectSpecSlugs(targetDir, changedRef)

	notes := make([]string, 0, 1)
	if selection.warning != "" {
		notes = append(notes, "Warning: "+selection.warning)
	}

	if selection.err != "" {
		payload := shared.NewObject()
		payload.Set("valid", false).
			Set("specs", []any{}).
			Set("error", selection.err)

		result := Result{Valid: false}
		result.notes = notes
		result.setRaw(payload)

		return result, &CLIError{
			Message: "Error: " + selection.err,
			Code:    2,
			Stdout:  shared.MarshalJSON(payload) + "\n",
			Notes:   notes,
		}
	}

	if len(selection.slugs) == 0 {
		message := "No specs found under .specs/changes."
		if selection.filtered {
			message = fmt.Sprintf("No spec changes detected since '%s'.", changedRef)
		}

		payload := shared.NewObject()
		payload.Set("valid", true).
			Set("specs", []any{}).
			Set("message", message)

		result := Result{Valid: true}
		result.notes = notes
		result.setRaw(payload)

		return result, nil
	}

	summaries := make([]*shared.Object, 0, len(selection.slugs))
	valid := true
	for _, slug := range selection.slugs {
		result := VerifySpec(slug, targetDir)
		if !result.Valid {
			valid = false
		}
		summary := shared.NewObject()
		summary.Set("slug", slug).
			Set("valid", result.Valid).
			Set("lane", result.Lane).
			Set("errors", len(result.Errors)).
			Set("warnings", len(result.Warnings))
		summaries = append(summaries, summary)
	}

	payload := shared.NewObject()
	payload.Set("valid", valid).Set("specs", summaries)

	result := Result{Valid: valid}
	result.notes = notes
	result.setRaw(payload)

	return result, nil
}

// renderAll renders the aggregate validator output.
func renderAll(result *Result, format string) Output {
	if format == "json" {
		return Output{Stdout: jsonPayload(result) + "\n", ExitCode: exitCode(result)}
	}

	if message, ok := result.Extra["message"].(string); ok {
		return Output{Stdout: yellow(message) + "\n", ExitCode: 0}
	}

	writes := make([]string, 0, 8)
	for _, summary := range result.extraObjects("specs") {
		slug, _ := summary.Get("slug")
		valid, _ := summary.Get("valid")
		lane, _ := summary.Get("lane")
		errorCount, _ := summary.Get("errors")
		warningCount, _ := summary.Get("warnings")

		status := colorize(colorRed, "FAIL")
		if valid == true {
			status = colorize(colorGreen, "PASS")
		}
		writes = append(writes, fmt.Sprintf("%s %v (%v, %v errors, %v warnings)\n", status, slug, lane, errorCount, warningCount))
	}

	if result.Valid {
		writes = append(writes, green("\nAll specs passed.")+"\n")
	} else {
		writes = append(writes, red("\nSome specs failed.")+"\n")
	}

	return Output{Stdout: strings.Join(writes, ""), ExitCode: exitCode(result)}
}

// selectSpecSlugs returns the specs the aggregate validator has to run on.
func selectSpecSlugs(targetDir string, changedRef string) specSelection {
	if changedRef == "" {
		return specSelection{slugs: readAllSpecSlugs(targetDir), filtered: false}
	}

	if err := runGit(targetDir, "rev-parse", "--verify", "--quiet", changedRef+"^{commit}"); err != nil {
		if isGitMissing(err) {
			return specSelection{
				slugs:   readAllSpecSlugs(targetDir),
				warning: "git is not available; validating all specs instead of changed specs.",
			}
		}
		return specSelection{
			slugs:    []string{},
			filtered: true,
			err:      fmt.Sprintf("Cannot resolve git ref '%s'. Ensure the ref exists and the target is a git repository; shallow clones may need a full fetch (fetch-depth: 0).", changedRef),
		}
	}

	output, err := gitOutput(targetDir, "diff", "--name-only", changedRef+"...HEAD")
	if err != nil {
		if isGitMissing(err) {
			return specSelection{
				slugs:   readAllSpecSlugs(targetDir),
				warning: "git is not available; validating all specs instead of changed specs.",
			}
		}
		return specSelection{
			slugs:    []string{},
			filtered: true,
			err:      fmt.Sprintf("Unable to diff against git ref '%s'. A shallow clone may be missing the merge base; fetch the ref with full history.", changedRef),
		}
	}

	seen := map[string]bool{}
	slugs := make([]string, 0, 4)
	for _, line := range strings.Split(output, "\n") {
		match := changedSpecPathPattern.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		if seen[match[1]] {
			continue
		}
		seen[match[1]] = true
		slugs = append(slugs, match[1])
	}
	sort.Strings(slugs)

	return specSelection{slugs: slugs, filtered: true}
}

// readAllSpecSlugs returns the slugs of every spec directory.
func readAllSpecSlugs(targetDir string) []string {
	entries, err := readDirectoryEntries(filepath.Join(targetDir, ".specs", "changes"))
	if err != nil {
		return []string{}
	}

	slugs := make([]string, 0, len(entries))
	for _, entry := range entries {
		info, err := os.Stat(filepath.Join(targetDir, ".specs", "changes", entry))
		if err != nil || !info.IsDir() {
			continue
		}
		slugs = append(slugs, entry)
	}
	sort.Strings(slugs)

	return slugs
}

// runGit runs a git command and discards its output.
func runGit(targetDir string, arguments ...string) error {
	command := exec.Command("git", arguments...)
	command.Dir = targetDir
	command.Stdout = nil
	command.Stderr = nil
	return command.Run()
}

// gitOutput runs a git command and returns its standard output.
func gitOutput(targetDir string, arguments ...string) (string, error) {
	command := exec.Command("git", arguments...)
	command.Dir = targetDir
	output, err := command.Output()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

// isGitMissing reports whether the failure was caused by a missing git
// executable.
func isGitMissing(err error) bool {
	if err == nil {
		return false
	}
	if execErr, ok := err.(*exec.Error); ok {
		return execErr.Err == exec.ErrNotFound
	}
	var pathError *os.PathError
	if asPathError(err, &pathError) {
		return os.IsNotExist(pathError.Err)
	}
	return false
}
