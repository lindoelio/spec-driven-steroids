package validate

import (
	"path/filepath"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

// ValidateSpec validates a brief or full spec with cross-file traceability.
func ValidateSpec(slug string, targetDir string) (Result, error) {
	return VerifySpec(slug, targetDir), nil
}

// VerifySpec validates a spec directory.
func VerifySpec(slug string, targetDir string) Result {
	structureResult := VerifySpecStructure(slug, targetDir)

	for _, issue := range structureResult.Errors {
		if issue.ErrorType == "Lane Error" {
			result := Result{Valid: false, Errors: structureResult.Errors, Warnings: structureResult.Warnings, Lane: structureResult.Lane}
			result.set("lane", structureResult.Lane).
				set("briefErrors", []string{}).
				set("requirementsErrors", []string{}).
				set("designErrors", []string{}).
				set("tasksErrors", []string{}).
				set("traceabilityReport", traceabilitySpecReport(false, []string{}))
			return result
		}
	}

	if structureResult.Lane == "brief" {
		return verifyBriefSpec(slug, targetDir, structureResult)
	}
	return verifyCompleteSpec(slug, targetDir, structureResult)
}

// verifyCompleteSpec validates a spec of the full lane.
func verifyCompleteSpec(slug string, targetDir string, structureResult Result) Result {
	errors := make([]shared.Issue, 0, 8)
	warnings := make([]shared.Issue, 0, 4)
	briefErrors := make([]string, 0, 4)
	requirementsErrors := make([]string, 0, 4)
	designErrors := make([]string, 0, 4)
	tasksErrors := make([]string, 0, 4)

	specDir := filepath.Join(targetDir, ".specs", "changes", slug)

	warnings = append(warnings, structureResult.Warnings...)
	if !structureResult.Valid {
		errors = append(errors, structureResult.Errors...)
	}

	requirementsContent := ""
	requirementsPath := filepath.Join(specDir, "requirements.md")
	if content, err := readFileContent(requirementsPath); err != nil {
		message := "Cannot read requirements.md: " + nodeErrorMessage(err, requirementsPath)
		requirementsErrors = append(requirementsErrors, message)
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "File Error").
			Set("context", message).
			Set("suggestedFix", "Ensure file exists in .specs/changes/{slug}/ directory").
			Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
	} else {
		requirementsContent = content
	}

	designContent := ""
	designPath := filepath.Join(specDir, "design.md")
	if content, err := readFileContent(designPath); err != nil {
		message := "Cannot read design.md: " + nodeErrorMessage(err, designPath)
		designErrors = append(designErrors, message)
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "File Error").
			Set("context", message).
			Set("suggestedFix", "Ensure file exists in .specs/changes/{slug}/ directory").
			Set("skillDocLink", SKILL_DOC_DESIGN))
	} else {
		designContent = content
	}

	tasksContent := ""
	tasksPath := filepath.Join(specDir, "tasks.md")
	if content, err := readFileContent(tasksPath); err != nil {
		message := "Cannot read tasks.md: " + nodeErrorMessage(err, tasksPath)
		tasksErrors = append(tasksErrors, message)
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "File Error").
			Set("context", message).
			Set("suggestedFix", "Ensure file exists in .specs/changes/{slug}/ directory").
			Set("skillDocLink", SKILL_DOC_TASKS))
	} else {
		tasksContent = content
	}

	if requirementsContent != "" {
		requirementsResult := VerifyRequirementsFile(requirementsContent)
		for _, warning := range requirementsResult.Warnings {
			warnings = append(warnings, warning.WithMessage("requirements.md: "+warning.Message))
		}
		if !requirementsResult.Valid {
			for _, issue := range requirementsResult.Errors {
				message := issue.Context
				if message == "" {
					message = issue.Message
				}
				if message == "" {
					message = "Unknown error"
				}
				requirementsErrors = append(requirementsErrors, message)
				errors = append(errors, issue.WithContext("requirements.md: "+message))
			}
		}
	}

	if designContent != "" {
		designResult := VerifyDesignFile(designContent, requirementsContent)
		for _, warning := range designResult.Warnings {
			warnings = append(warnings, warning.WithMessage("design.md: "+warning.Message))
		}
		if !designResult.Valid {
			for _, issue := range designResult.Errors {
				message := issue.Context
				if message == "" {
					message = issue.Message
				}
				if message == "" {
					message = "Unknown error"
				}
				designErrors = append(designErrors, message)
				errors = append(errors, issue.WithContext("design.md: "+message))
			}
		}
	}

	if tasksContent != "" {
		tasksResult := VerifyTasksFile(tasksContent, designContent, requirementsContent)
		for _, warning := range tasksResult.Warnings {
			warnings = append(warnings, warning.WithMessage("tasks.md: "+warning.Message))
		}
		if !tasksResult.Valid {
			for _, issue := range tasksResult.Errors {
				message := issue.Context
				if message == "" {
					message = issue.Message
				}
				if message == "" {
					message = "Unknown error"
				}
				tasksErrors = append(tasksErrors, message)
				errors = append(errors, issue.WithContext("tasks.md: "+message))
			}
		}
	}

	desIDs := []string{}
	if designContent != "" {
		desIDs = shared.ExtractDeclaredDesignElementIDs(designContent)
	}
	taskDesImpl := []string{}
	if tasksContent != "" {
		for _, match := range implementsPattern.FindAllStringSubmatch(tasksContent, -1) {
			taskDesImpl = append(taskDesImpl, desRefPattern.FindAllString(match[1], -1)...)
		}
	}
	orphans := make([]string, 0, 4)

	for _, desID := range desIDs {
		if containsString(taskDesImpl, desID) {
			continue
		}
		orphans = append(orphans, desID)
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Traceability Error").
			Set("context", desID+" has no implementation task").
			Set("suggestedFix", "Add a task with _Implements: "+desID+"_").
			Set("skillDocLink", SKILL_DOC_TASKS))
	}

	result := Result{Valid: len(errors) == 0, Errors: errors, Warnings: warnings, Lane: "full"}
	result.set("lane", "full").
		set("briefErrors", briefErrors).
		set("requirementsErrors", requirementsErrors).
		set("designErrors", designErrors).
		set("tasksErrors", tasksErrors).
		set("traceabilityReport", traceabilitySpecReport(len(orphans) == 0, orphans))

	return result
}

// verifyBriefSpec validates a spec of the brief lane.
func verifyBriefSpec(slug string, targetDir string, structureResult Result) Result {
	errors := make([]shared.Issue, 0, 8)
	warnings := make([]shared.Issue, 0, 4)
	briefErrors := make([]string, 0, 4)

	specDir := filepath.Join(targetDir, ".specs", "changes", slug)

	errors = append(errors, structureResult.Errors...)
	warnings = append(warnings, structureResult.Warnings...)

	briefContent := ""
	briefPath := filepath.Join(specDir, "brief.md")
	if content, err := readFileContent(briefPath); err != nil {
		message := "Cannot read brief.md: " + nodeErrorMessage(err, briefPath)
		briefErrors = append(briefErrors, message)
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "File Error").
			Set("context", message).
			Set("suggestedFix", "Ensure brief.md exists in .specs/changes/{slug}/").
			Set("skillDocLink", SKILL_DOC_BRIEF))
	} else {
		briefContent = content
	}

	if briefContent != "" {
		briefResult := VerifyBriefFile(briefContent)
		for _, warning := range briefResult.Warnings {
			warnings = append(warnings, warning.WithMessage("brief.md: "+warning.Message))
		}
		for _, issue := range briefResult.Errors {
			message := issue.Context
			if message == "" {
				message = issue.Message
			}
			if message == "" {
				message = "Unknown error"
			}
			briefErrors = append(briefErrors, message)
			errors = append(errors, issue.WithContext("brief.md: "+message))
		}
	}

	result := Result{Valid: len(errors) == 0, Errors: errors, Warnings: warnings, Lane: "brief"}
	result.set("lane", "brief").
		set("briefErrors", briefErrors).
		set("requirementsErrors", []string{}).
		set("designErrors", []string{}).
		set("tasksErrors", []string{}).
		set("traceabilityReport", traceabilitySpecReport(len(errors) == 0, []string{}))

	return result
}

// traceabilitySpecReport builds the traceability report of a spec.
func traceabilitySpecReport(complete bool, orphans []string) *shared.Object {
	report := shared.NewObject()
	report.Set("complete", complete).
		Set("orphans", orphans).
		Set("circular", []string{})
	return report
}

// renderSpec renders the spec validator output.
func renderSpec(result *Result, format string) Output {
	if format == "json" {
		return Output{Stdout: jsonPayload(result) + "\n", ExitCode: exitCode(result)}
	}

	writes := make([]string, 0, 16)
	if !result.Valid {
		writes = append(writes, red("❌ Spec validation failed:\n")+"\n")
		sections := []struct {
			title    string
			messages []string
		}{
			{"Brief errors", result.extraStrings("briefErrors")},
			{"Requirements errors", result.extraStrings("requirementsErrors")},
			{"Design errors", result.extraStrings("designErrors")},
			{"Tasks errors", result.extraStrings("tasksErrors")},
		}
		for _, section := range sections {
			if len(section.messages) == 0 {
				continue
			}
			writes = append(writes, red(section.title+":")+"\n")
			for _, message := range section.messages {
				writes = append(writes, "  • "+message+"\n")
			}
			writes = append(writes, "\n")
		}
		return Output{Stdout: strings.Join(writes, ""), ExitCode: 1}
	}

	complete := false
	orphans := []string{}
	if report, ok := result.Extra["traceabilityReport"].(*shared.Object); ok {
		if value, present := report.Get("complete"); present {
			complete, _ = value.(bool)
		}
		if value, present := report.Get("orphans"); present {
			orphans, _ = value.([]string)
		}
	}

	writes = append(writes,
		green("✅ Spec validation passed.")+"\n",
		"\nLane: "+result.Lane+"\n",
		"\nTraceability Report:\n",
		"  Complete: "+yesNo(complete)+"\n",
	)
	if len(orphans) > 0 {
		writes = append(writes, yellow("  Orphaned design elements: "+strings.Join(orphans, ", "))+"\n")
	}
	if len(result.Warnings) > 0 {
		writes = append(writes, yellow("\nWarnings:")+"\n")
		for _, warning := range result.Warnings {
			writes = append(writes, "  • "+warning.Message+"\n")
		}
	}

	return Output{Stdout: strings.Join(writes, ""), ExitCode: 0}
}

func yesNo(value bool) string {
	if value {
		return "Yes"
	}
	return "No"
}
