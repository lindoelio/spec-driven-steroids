package validate

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

// FullSpecFiles are the artifacts of the full lane.
var FullSpecFiles = []string{"requirements.md", "design.md", "tasks.md"}

// BriefSpecFiles are the artifacts of the brief lane.
var BriefSpecFiles = []string{"brief.md"}

// DetectSpecLane returns the lane of a spec directory.
func DetectSpecLane(files []string) string {
	for _, file := range files {
		if file == "brief.md" {
			return "brief"
		}
	}
	return "full"
}

// ValidateStructure verifies that a spec directory holds either brief.md or
// the full requirements, design and tasks set.
func ValidateStructure(slug string, targetDir string) (Result, error) {
	return VerifySpecStructure(slug, targetDir), nil
}

// VerifySpecStructure verifies the structure of a spec directory.
func VerifySpecStructure(slug string, targetDir string) Result {
	errors := make([]shared.Issue, 0, 4)
	warnings := make([]shared.Issue, 0, 1)
	specDir := filepath.Join(targetDir, ".specs", "changes", slug)

	result := Result{}

	info, err := os.Stat(specDir)
	if err != nil {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Spec directory does not exist: "+specDir).
			Set("message", "Spec directory does not exist").
			Set("suggestedFix", "Create spec directory with: mkdir -p .specs/changes/{slug}"))

		result.Valid = false
		result.Errors = errors
		result.Warnings = warnings
		result.Lane = "full"
		result.set("specDir", specDir).
			set("filesFound", []string{}).
			set("lane", "full").
			set("missingFiles", FullSpecFiles).
			set("unexpectedFiles", []string{})
		return result
	}

	if !info.IsDir() {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Path is not a directory: "+specDir).
			Set("message", "Path is not a directory").
			Set("suggestedFix", "Create spec directory with: mkdir -p .specs/changes/{slug}"))

		result.Valid = false
		result.Errors = errors
		result.Warnings = warnings
		result.Lane = "full"
		result.set("specDir", specDir).
			set("filesFound", []string{}).
			set("lane", "full").
			set("missingFiles", FullSpecFiles).
			set("unexpectedFiles", []string{})
		return result
	}

	files, err := readDirectoryEntries(specDir)
	if err != nil {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Spec directory does not exist: "+specDir).
			Set("message", "Spec directory does not exist").
			Set("suggestedFix", "Create spec directory with: mkdir -p .specs/changes/{slug}"))

		result.Valid = false
		result.Errors = errors
		result.Warnings = warnings
		result.Lane = "full"
		result.set("specDir", specDir).
			set("filesFound", []string{}).
			set("lane", "full").
			set("missingFiles", FullSpecFiles).
			set("unexpectedFiles", []string{})
		return result
	}

	lane := DetectSpecLane(files)
	requiredFiles := FullSpecFiles
	if lane == "brief" {
		requiredFiles = BriefSpecFiles
	}

	missingFiles := make([]string, 0, 3)
	for _, file := range requiredFiles {
		if !containsString(files, file) {
			missingFiles = append(missingFiles, file)
		}
	}

	ignoredFiles := map[string]bool{".DS_Store": true, "Thumbs.db": true}
	unexpectedFiles := make([]string, 0, 4)
	for _, file := range files {
		if containsString(requiredFiles, file) || ignoredFiles[file] || strings.HasPrefix(file, ".") {
			continue
		}
		unexpectedFiles = append(unexpectedFiles, file)
	}

	fullArtifacts := make([]string, 0, 3)
	for _, file := range FullSpecFiles {
		if containsString(files, file) {
			fullArtifacts = append(fullArtifacts, file)
		}
	}

	if !containsString(files, "brief.md") && len(fullArtifacts) == 0 {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Lane Error").
			Set("context", "No lane artifacts found").
			Set("message", "No lane artifacts found").
			Set("suggestedFix", "Create brief.md (default) or begin the full requirements/design/tasks workflow. Archived snapshots are not active artifacts."))

		result.Valid = false
		result.Errors = errors
		result.Warnings = warnings
		result.Lane = lane
		result.set("lane", lane).
			set("specDir", specDir).
			set("filesFound", files).
			set("missingFiles", []string{}).
			set("unexpectedFiles", unexpectedFiles)
		return result
	}

	if containsString(files, "brief.md") && len(fullArtifacts) > 0 {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Lane Error").
			Set("context", "Mixed lane artifacts: brief.md, "+strings.Join(fullArtifacts, ", ")).
			Set("message", "Brief and full artifacts cannot be active together").
			Set("suggestedFix", "Resolve the active lane with the user. Archive inactive artifacts only after an approved transition; do not delete them silently."))
	}

	for _, missingFile := range missingFiles {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Missing required file: "+missingFile).
			Set("message", "Missing required file: "+missingFile).
			Set("suggestedFix", "Create "+missingFile+" in "+specDir+"/"))
	}

	if len(unexpectedFiles) > 0 {
		suggestedFix := "A full spec directory may contain only requirements.md, design.md, and tasks.md. Remove or rename extra files"
		if lane == "brief" {
			suggestedFix = "A brief spec directory may contain only brief.md. Remove full-lane or extra files"
		}
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Unexpected files found: "+strings.Join(unexpectedFiles, ", ")).
			Set("message", "Unexpected files found").
			Set("suggestedFix", suggestedFix))
	}

	result.Valid = len(errors) == 0
	result.Errors = errors
	result.Warnings = warnings
	result.Lane = lane
	result.set("lane", lane).
		set("specDir", specDir).
		set("filesFound", files).
		set("missingFiles", missingFiles).
		set("unexpectedFiles", unexpectedFiles)

	return result
}

// renderStructure renders the structure validator output.
func renderStructure(result *Result, format string) Output {
	if format == "json" {
		return Output{Stdout: jsonPayload(result) + "\n", ExitCode: exitCode(result)}
	}

	writes := make([]string, 0, 8)
	if !result.Valid {
		writes = append(writes, red("❌ Structure validation failed:\n")+"\n")
		for index := range result.Errors {
			issue := &result.Errors[index]
			body := issue.Context
			if body == "" {
				body = issue.Message
			}
			writes = append(writes, "  • "+body+"\n")
			if issue.SuggestedFix != "" {
				writes = append(writes, gray("    → "+issue.SuggestedFix)+"\n")
			}
		}
		return Output{Stdout: strings.Join(writes, ""), ExitCode: 1}
	}

	writes = append(writes,
		green("✅ Structure validation passed.")+"\n",
		"\n",
		"Spec directory: "+result.extraString("specDir")+"\n",
		"Lane: "+result.Lane+"\n",
		"Files found: "+strings.Join(result.extraStrings("filesFound"), ", ")+"\n",
	)

	return Output{Stdout: strings.Join(writes, ""), ExitCode: 0}
}

// readDirectoryEntries lists the entries of a directory sorted by name, the
// order the Node.js runtime reports them in.
func readDirectoryEntries(path string) ([]string, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	return names, nil
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func exitCode(result *Result) int {
	if result.Valid {
		return 0
	}
	return 1
}
