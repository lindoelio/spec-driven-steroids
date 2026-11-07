package validate

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

// SKILL_DOC_DESIGN points at the technical designer skill.
const SKILL_DOC_DESIGN = "skills/spec-driven-technical-designer/SKILL.md"

// codeAnatomyRequiredSubsections are the subsections the Code Anatomy section
// has to declare.
var codeAnatomyRequiredSubsections = []string{
	"Coverage Declaration",
	"Required Touchpoints",
	"Known Impact Surface",
	"Discovery Targets",
	"Out of Scope",
}

// validCoverageValues are the accepted coverage declarations.
var validCoverageValues = []string{"Exhaustive", "Representative", "Initial Discovery Only"}

var (
	codeAnatomyHeadingPattern = regexp.MustCompile(`(?mi)^##\s+Code Anatomy\b.*$`)
	nextSectionPattern        = regexp.MustCompile(`\n##\s+`)
	coveragePattern           = regexp.MustCompile(`(?im)^\s*Coverage:\s*(.+?)\s*$`)
	designSectionPattern      = regexp.MustCompile(`(?i)##\s+(Overview|Code Anatomy|Traceability Matrix)`)
	actionableTablePattern    = regexp.MustCompile(`\|[^\n]*\|[^\n]*\|`)
	actionableBulletPattern   = regexp.MustCompile(`(?m)^-\s+\S`)
	notChecklistPattern       = regexp.MustCompile(`(?i)not\s+(?:a\s+)?(?:closed\s+)?(?:completion\s+)?checklist|not\s+exhaustive`)
)

// ValidateDesign validates a design.md file. The requirements document is
// optional; when it is given the traceability links are checked against it.
func ValidateDesign(path string, requirementsPath string) (Result, error) {
	fullPath := resolvePath(path)
	content, err := readFileContent(fullPath)
	if err != nil {
		return Result{}, &CLIError{Message: "Error: Cannot read file: " + fullPath, Code: 1}
	}

	requirementsContent := ""
	if requirementsPath != "" {
		resolved := resolvePath(requirementsPath)
		loaded, err := readFileContent(resolved)
		if err != nil {
			return Result{}, &CLIError{Message: "Error: Cannot read requirements file: " + resolved, Code: 1}
		}
		requirementsContent = loaded
	}

	return VerifyDesignFile(content, requirementsContent), nil
}

// VerifyDesignFile validates the content of a design document.
func VerifyDesignFile(content string, requirementsContent string) Result {
	errors := make([]shared.Issue, 0, 8)
	warnings := make([]shared.Issue, 0, 4)

	enforceDocumentSections := designSectionPattern.MatchString(content) ||
		strings.Contains(content, "# Design Document")

	if enforceDocumentSections && !strings.Contains(content, "## Overview") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Overview section not found").
			Set("suggestedFix", "Add ## Overview section describing high-level design approach").
			Set("skillDocLink", SKILL_DOC_DESIGN))
	}
	if enforceDocumentSections && !strings.Contains(content, "## System Architecture") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "System Architecture section not found").
			Set("suggestedFix", "Add ## System Architecture section with Mermaid diagrams").
			Set("skillDocLink", SKILL_DOC_DESIGN))
	}
	if enforceDocumentSections && !strings.Contains(content, "## Code Anatomy") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Code Anatomy section not found").
			Set("suggestedFix", "Add ## Code Anatomy section with file paths and details").
			Set("skillDocLink", SKILL_DOC_DESIGN))
	}

	codeAnatomy := extractCodeAnatomySection(content)
	if enforceDocumentSections && codeAnatomy != "" {
		for _, subsection := range codeAnatomyRequiredSubsections {
			pattern := regexp.MustCompile(`(?im)^###\s+` + regexp.QuoteMeta(subsection) + `\b`)
			if !pattern.MatchString(codeAnatomy) {
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Structure Error").
					Set("context", "Code Anatomy missing "+subsection+" subsection").
					Set("suggestedFix", "Add ### "+subsection+" under ## Code Anatomy").
					SetRawLine(shared.FindLineNumber(content, regexp.MustCompile(`(?im)^##\s+Code Anatomy\b`))).
					Set("skillDocLink", SKILL_DOC_DESIGN))
			}
		}

		coverage := extractCoverageValue(codeAnatomy)
		if coverage == "" || !containsString(validCoverageValues, coverage) {
			errors = append(errors, *shared.NewIssue("error").
				Set("errorType", "Structure Error").
				Set("context", "Code Anatomy coverage declaration is missing or invalid").
				Set("suggestedFix", "Add Coverage: Exhaustive, Coverage: Representative, or Coverage: Initial Discovery Only under ### Coverage Declaration").
				SetRawLine(shared.FindLineNumber(content, regexp.MustCompile(`(?im)^###\s+Coverage Declaration\b`))).
				Set("skillDocLink", SKILL_DOC_DESIGN))
		}

		if coverage != "" && coverage != "Exhaustive" {
			discoveryStart := regexp.MustCompile(`(?im)^###\s+Discovery Targets\b.*$`).FindStringIndex(codeAnatomy)
			afterDiscoveryHeading := ""
			if discoveryStart != nil {
				afterDiscoveryHeading = codeAnatomy[discoveryStart[1]:]
			}
			nextSubsection := regexp.MustCompile(`\n###\s+`).FindStringIndex(afterDiscoveryHeading)
			discoverySection := ""
			if discoveryStart != nil {
				if nextSubsection == nil {
					discoverySection = codeAnatomy[discoveryStart[0]:]
				} else {
					discoverySection = codeAnatomy[discoveryStart[0] : discoveryStart[1]+nextSubsection[0]]
				}
			}
			hasActionableDiscoveryTarget := actionableTablePattern.MatchString(discoverySection) ||
				actionableBulletPattern.MatchString(discoverySection)
			warnsNotChecklist := notChecklistPattern.MatchString(codeAnatomy)

			if !hasActionableDiscoveryTarget {
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Structure Error").
					Set("context", "Non-exhaustive Code Anatomy must include actionable Discovery Targets").
					Set("suggestedFix", "Add concrete grep patterns, commands, directories, entrypoints, exports, tests, or integrations under ### Discovery Targets").
					SetRawLine(shared.FindLineNumber(content, regexp.MustCompile(`(?im)^###\s+Discovery Targets\b`))).
					Set("skillDocLink", SKILL_DOC_DESIGN))
			}

			if !warnsNotChecklist {
				warnings = append(warnings, *shared.NewIssue("warning").
					Set("errorType", "Structure Warning").
					Set("message", "Non-exhaustive Code Anatomy should state that it is not a completion checklist").
					SetRawLine(shared.FindLineNumber(content, regexp.MustCompile(`(?im)^###\s+Coverage Declaration\b`))))
			}
		}
	}

	if !strings.Contains(content, "```mermaid") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "No Mermaid diagram code blocks found").
			Set("suggestedFix", "Add Mermaid diagram in ```mermaid ... ``` code blocks").
			Set("skillDocLink", SKILL_DOC_DESIGN))
	}

	desIDs := shared.ExtractDesignElementIDs(content)
	if len(desIDs) == 0 {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Format Error").
			Set("context", "No DES-X design element IDs found").
			Set("suggestedFix", "Number design elements with DES-1, DES-2, etc.").
			Set("skillDocLink", SKILL_DOC_DESIGN))
	}

	reqIDs := []string{}
	if requirementsContent != "" {
		reqIDs = append(reqIDs, shared.ExtractDeclaredRequirementIDs(requirementsContent)...)
		reqIDs = append(reqIDs, shared.ExtractAcceptanceCriteriaRefs(requirementsContent)...)
	}

	mermaidBlocks := shared.ExtractMermaidBlocks(content)
	mermaidErrors := make([]*shared.Object, 0, 4)
	mermaidWarnings := make([]*shared.Object, 0, 4)
	diagramTypes := make([]string, 0, 4)

	for _, block := range mermaidBlocks {
		result := shared.ValidateMermaidDiagram(block.Content, block.StartLine)
		if !result.Valid && len(result.Errors) > 0 {
			for _, mermaidError := range result.Errors {
				object := shared.NewObject()
				object.Set("line", mermaidError.Line)
				object.Set("errorType", mermaidError.ErrorType)
				object.Set("message", mermaidError.Message)
				mermaidErrors = append(mermaidErrors, object)

				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Mermaid "+mermaidError.ErrorType).
					Set("context", fmt.Sprintf("Line %d: %s", mermaidError.Line, mermaidError.Message)).
					Set("suggestedFix", mermaidError.SuggestedFix).
					Set("skillDocLink", SKILL_DOC_DESIGN))
			}
		}
		for _, mermaidWarning := range result.Warnings {
			object := shared.NewObject()
			if mermaidWarning.Line > 0 {
				object.Set("line", mermaidWarning.Line)
			}
			object.Set("message", mermaidWarning.Message)
			object.Set("errorType", "Mermaid Warning")
			mermaidWarnings = append(mermaidWarnings, object)
		}
		if result.DiagramType != "" {
			diagramTypes = append(diagramTypes, result.DiagramType)
		}
	}

	traceReport := shared.BuildTraceabilityReport(content, reqIDs)

	for _, orphan := range traceReport.Orphaned {
		line := shared.FindLineNumber(content, regexp.MustCompile(`^###\s+`+regexp.QuoteMeta(orphan)+`\b`))
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Traceability Error").
			Set("context", orphan+" has no requirement traceability link").
			Set("suggestedFix", "Add _Implements: REQ-X.Y_ under "+orphan).
			Set("line", line).
			Set("skillDocLink", SKILL_DOC_DESIGN))
	}

	for _, invalidRef := range traceReport.InvalidReqRefs {
		target := invalidRef
		if parts := strings.SplitN(invalidRef, " -> ", 2); len(parts) == 2 {
			target = escapeFirstDot(parts[1])
		}
		line := shared.FindLineNumber(content, compilePattern(target))
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Traceability Error").
			Set("context", invalidRef+" references a requirement or acceptance criterion not defined in requirements.md").
			Set("suggestedFix", "Fix the _Implements:_ reference so it matches an existing REQ-* or REQ-*.* entry").
			Set("line", line).
			Set("skillDocLink", SKILL_DOC_DESIGN))
	}

	if enforceDocumentSections && !strings.Contains(content, "## Traceability Matrix") {
		warnings = append(warnings, *shared.NewIssue("warning").
			Set("errorType", "Structure Warning").
			Set("message", "Traceability Matrix section not found"))
	}

	traceabilityReport := shared.NewObject()
	traceabilityReport.Set("linked", traceReport.Linked).
		Set("orphaned", traceReport.Orphaned).
		Set("invalidReqRefs", traceReport.InvalidReqRefs)

	mermaidValidation := shared.NewObject()
	mermaidValidation.Set("valid", len(mermaidErrors) == 0).
		Set("errors", mermaidErrors).
		Set("warnings", mermaidWarnings).
		Set("diagramCount", len(mermaidBlocks)).
		Set("diagramTypes", diagramTypes)

	result := Result{Valid: len(errors) == 0, Errors: errors, Warnings: warnings}
	result.set("traceabilityReport", traceabilityReport).
		set("mermaidValidation", mermaidValidation)

	return result
}

// renderDesign renders the design validator output.
func renderDesign(result *Result, format string) Output {
	if format == "json" {
		return Output{Stdout: jsonPayload(result) + "\n", ExitCode: exitCode(result)}
	}

	writes := make([]string, 0, 16)
	if !result.Valid {
		writes = append(writes, red("❌ Design validation failed:\n")+"\n")
		for index := range result.Errors {
			issue := &result.Errors[index]
			writes = append(writes, shared.FormatError(issue)+"\n", "\n")
		}
		return Output{Stdout: strings.Join(writes, ""), ExitCode: 1}
	}

	traceability, _ := result.Extra["traceabilityReport"].(*shared.Object)
	linked := 0
	orphaned := []string{}
	if traceability != nil {
		if value, ok := traceability.Get("linked"); ok {
			linked = len(value.([]string))
		}
		if value, ok := traceability.Get("orphaned"); ok {
			orphaned = value.([]string)
		}
	}

	writes = append(writes,
		green("✅ Design validation passed.")+"\n",
		fmt.Sprintf("\nFound %d traceability links.\n", linked),
	)
	if len(orphaned) > 0 {
		writes = append(writes, yellow(fmt.Sprintf("Warning: %d orphaned design elements.", len(orphaned)))+"\n")
	}

	return Output{Stdout: strings.Join(writes, ""), ExitCode: 0}
}

// extractCodeAnatomySection returns the Code Anatomy section of a design
// document.
func extractCodeAnatomySection(content string) string {
	location := codeAnatomyHeadingPattern.FindStringIndex(content)
	if location == nil {
		return ""
	}

	afterHeading := content[location[1]:]
	nextSection := nextSectionPattern.FindStringIndex(afterHeading)
	if nextSection == nil {
		return content[location[0]:]
	}
	return content[location[0] : location[1]+nextSection[0]]
}

// extractCoverageValue returns the coverage declaration of a Code Anatomy
// section.
func extractCoverageValue(codeAnatomy string) string {
	match := coveragePattern.FindStringSubmatch(codeAnatomy)
	if match == nil {
		return ""
	}
	return strings.TrimSpace(match[1])
}

// escapeFirstDot escapes the first dot of a value, the way the oracle builds
// the lookup pattern of an invalid requirement reference.
func escapeFirstDot(value string) string {
	index := strings.Index(value, ".")
	if index < 0 {
		return value
	}
	return value[:index] + `\.` + value[index+1:]
}

// compilePattern builds a regular expression from a raw pattern, falling back
// to a literal match when the pattern is not a valid expression.
func compilePattern(pattern string) *regexp.Regexp {
	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return regexp.MustCompile(regexp.QuoteMeta(pattern))
	}
	return compiled
}
