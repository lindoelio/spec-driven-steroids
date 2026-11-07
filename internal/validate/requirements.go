package validate

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

// SKILL_DOC_REQUIREMENTS points at the requirements writer skill.
const SKILL_DOC_REQUIREMENTS = "skills/spec-driven-requirements-writer/SKILL.md"

var (
	requirementsHeadingPattern = regexp.MustCompile(`(?i)^###\s+(?:Requirement\s+(\d+)\s*:|(REQ-(\d+))\b)`)
	acceptanceCriterionPattern = regexp.MustCompile(`^\s*(\d+)\.(\d+)\s+([^\r\n]+)$`)
)

// ValidateRequirements validates a requirements.md file.
func ValidateRequirements(path string) (Result, error) {
	fullPath := resolvePath(path)
	content, err := readFileContent(fullPath)
	if err != nil {
		return Result{}, &CLIError{Message: "Error: Cannot read file: " + fullPath, Code: 1}
	}
	return VerifyRequirementsFile(content), nil
}

// VerifyRequirementsFile validates the content of a requirements document.
func VerifyRequirementsFile(content string) Result {
	errors := make([]shared.Issue, 0, 8)
	warnings := make([]shared.Issue, 0, 1)
	requirementsFound := make([]string, 0, 8)
	earsPatterns := make([]string, 0, 8)

	enforceDocumentSections := strings.Contains(content, "# Requirements Document")

	if enforceDocumentSections && !strings.Contains(content, "## Introduction") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Introduction section not found").
			Set("suggestedFix", "Add ## Introduction section at top with project background and objectives").
			Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
	}
	if enforceDocumentSections && !strings.Contains(content, "## Glossary") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Glossary section not found").
			Set("suggestedFix", "Add ## Glossary section defining key terms").
			Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
	}
	if enforceDocumentSections && !strings.Contains(content, "## Requirements") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Requirements section not found").
			Set("suggestedFix", "Add ## Requirements section with REQ-X numbering").
			Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
	}

	reqMatches := shared.ExtractDeclaredRequirementIDs(content)
	if len(reqMatches) > 0 {
		requirementsFound = append(requirementsFound, reqMatches...)
	} else {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Format Error").
			Set("context", "No REQ-X IDs found").
			Set("suggestedFix", "Number each requirement with REQ-1, REQ-2, etc.").
			Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
	}

	criteriaByReq := newOrderedStringMap()
	currentReq := ""

	for index, line := range splitLines(content) {
		heading := requirementsHeadingPattern.FindStringSubmatch(line)
		if heading != nil {
			number := heading[1]
			if number == "" {
				number = heading[3]
			}
			currentReq = "REQ-" + number
			criteriaByReq.set(currentReq, []string{})
			continue
		}

		criterion := acceptanceCriterionPattern.FindStringSubmatch(line)
		if criterion == nil || currentReq == "" {
			continue
		}

		criterionReq := "REQ-" + criterion[1]
		if criterionReq != currentReq {
			errors = append(errors, *shared.NewIssue("error").
				Set("errorType", "Format Error").
				Set("context", fmt.Sprintf("Line %d: acceptance criterion %s.%s does not match %s", index+1, criterion[1], criterion[2], currentReq)).
				Set("suggestedFix", "Renumber the criterion to match "+currentReq).
				Set("line", index+1).
				Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
		}

		validation := shared.ValidateEarsCriterion(criterion[3])
		if validation.Pattern != "" {
			earsPatterns = append(earsPatterns, validation.Pattern)
		}
		criteriaByReq.append(currentReq, criterion[1]+"."+criterion[2])

		if !validation.Valid {
			errors = append(errors, *shared.NewIssue("error").
				Set("errorType", "EARS Error").
				Set("context", fmt.Sprintf("Line %d: %s", index+1, strings.Join(validation.Errors, "; "))).
				Set("suggestedFix", "Rewrite the criterion using canonical EARS syntax").
				Set("line", index+1).
				Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
		}
	}

	if criteriaByReq.len() == 0 || criteriaByReq.everyEmpty() {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Format Error").
			Set("context", "No 1.1, 1.2, etc. numbering found").
			Set("suggestedFix", "Add numbered acceptance criteria for each requirement").
			Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
	}

	for _, reqID := range reqMatches {
		if len(criteriaByReq.get(reqID)) == 0 {
			errors = append(errors, *shared.NewIssue("error").
				Set("errorType", "Format Error").
				Set("context", reqID+" has no acceptance criteria").
				Set("suggestedFix", "Add at least one numbered acceptance criterion under "+reqID).
				Set("skillDocLink", SKILL_DOC_REQUIREMENTS))
		}
	}

	result := Result{Valid: len(errors) == 0, Errors: errors, Warnings: warnings}
	result.set("requirementsFound", requirementsFound).
		set("earsPatterns", earsPatterns)

	return result
}

// renderRequirements renders the requirements validator output.
func renderRequirements(result *Result, format string) Output {
	if format == "json" {
		return Output{Stdout: jsonPayload(result) + "\n", ExitCode: exitCode(result)}
	}

	writes := make([]string, 0, 16)
	if !result.Valid {
		writes = append(writes, red("❌ Requirements validation failed:\n")+"\n")
		for index := range result.Errors {
			issue := &result.Errors[index]
			writes = append(writes, shared.FormatError(issue)+"\n", "\n")
		}
		return Output{Stdout: strings.Join(writes, ""), ExitCode: 1}
	}

	writes = append(writes,
		green("✅ Requirements validation passed.")+"\n",
		fmt.Sprintf("\nFound %d requirements.\n", len(result.extraStrings("requirementsFound"))),
		"EARS patterns: "+strings.Join(result.extraStrings("earsPatterns"), ", ")+"\n",
	)

	return Output{Stdout: strings.Join(writes, ""), ExitCode: 0}
}

// orderedStringMap keeps the insertion order of its keys.
type orderedStringMap struct {
	keys   []string
	values map[string][]string
}

func newOrderedStringMap() *orderedStringMap {
	return &orderedStringMap{values: map[string][]string{}}
}

func (m *orderedStringMap) set(key string, value []string) {
	if _, ok := m.values[key]; !ok {
		m.keys = append(m.keys, key)
	}
	m.values[key] = value
}

func (m *orderedStringMap) get(key string) []string {
	return m.values[key]
}

func (m *orderedStringMap) append(key string, value string) {
	m.values[key] = append(m.values[key], value)
}

func (m *orderedStringMap) len() int {
	return len(m.keys)
}

func (m *orderedStringMap) everyEmpty() bool {
	for _, key := range m.keys {
		if len(m.values[key]) > 0 {
			return false
		}
	}
	return true
}

// splitLines splits a document into lines the way JavaScript splits a string
// on "\n".
func splitLines(content string) []string {
	return strings.Split(content, "\n")
}
