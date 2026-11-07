package validate

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

// SKILL_DOC_TASKS points at the task decomposer skill.
const SKILL_DOC_TASKS = "skills/spec-driven-task-decomposer/SKILL.md"

var (
	phaseHeaderPattern      = regexp.MustCompile(`(?mi)^##\s*Phase\s+\d+\s*:[^\n]*`)
	phaseNumberPattern      = regexp.MustCompile(`(?i)^##\s*Phase\s+(\d+)\s*:`)
	finalCheckpointPattern  = regexp.MustCompile(`(?i)Final\s+Checkpoint`)
	acceptanceTestingPatt   = regexp.MustCompile(`(?i)Acceptance\s+Criteria\s+Testing`)
	taskLinePattern         = regexp.MustCompile(`(?m)^- \[[^\]]\]\s+.*$`)
	taskStartPattern        = regexp.MustCompile(`^- \[[^\]]\]\s+`)
	taskItemPattern         = regexp.MustCompile(`^- \[([^\]])\]\s+([^\r\n]*)$`)
	taskIdPattern           = regexp.MustCompile(`\d+\.\d+`)
	taskPhasePattern        = regexp.MustCompile(`^(\d+)\.`)
	dependsPattern          = regexp.MustCompile(`(?i)_Depends:\s*([^_\n]+)_`)
	implementsPattern       = regexp.MustCompile(`(?i)_Implements:\s*([^_\n]+)_`)
	desRefPattern           = regexp.MustCompile(`DES-\d+`)
	acceptanceRefPattern    = regexp.MustCompile(`REQ-\d+\.\d+`)
	numberedTaskIdsPattern  = regexp.MustCompile(`- \[[^\]]\]\s+\d+\.\d+\b`)
	implementsTagPattern    = regexp.MustCompile(`(?i)_Implements:`)
	taskLabelNumberPattern  = regexp.MustCompile(`^\d+\.\d+\s+`)
	discoveryEvidenceHeader = regexp.MustCompile(`(?i)^##\s+Discovery Evidence\s*$`)
	nextHeadingPattern      = regexp.MustCompile(`^##\s+`)
	targetLinePattern       = regexp.MustCompile(`(?i)^- Target:\s+\S`)
	resultLinePattern       = regexp.MustCompile(`(?im)^[ \t]+- Result:\s+\S`)
	planImpactPattern       = regexp.MustCompile(`(?im)^[ \t]+- Plan impact:\s+\S`)
	placeholderPattern      = regexp.MustCompile(`(?i)\b(?:TODO|TBD|TBA|FIXME)\b|<\s*(?:discovery target|search method|result|touchpoints? found|task ids?|plan impact|describe[^>]*|fill(?: in)?[^>]*)\s*>`)
	legacyDiscoveryPattern  = regexp.MustCompile(`(?i)\b(?:discovery|discover|inventory)\b[\s\S]{0,300}\b(?:targets?|implementation|codebase|touchpoints?|files?|entrypoints?|exports?|tests?|integrations?)\b|\b(?:implementation|codebase|touchpoints?)\b[\s\S]{0,120}\b(?:discovery|inventory)\b`)
)

// dependencyRef is a task dependency read from a _Depends_ tag.
type dependencyRef struct {
	ref  string
	line int
}

// implementationTask is a task that implements a design element.
type implementationTask struct {
	id    string
	title string
	text  string
	phase string
	line  int
}

// ValidateTasks validates a tasks.md file. The design and requirements
// documents are optional; when they are given the traceability links are
// checked against them.
func ValidateTasks(path string, designPath string, requirementsPath string) (Result, error) {
	fullPath := resolvePath(path)
	content, err := readFileContent(fullPath)
	if err != nil {
		return Result{}, &CLIError{Message: "Error: Cannot read file: " + fullPath, Code: 1}
	}

	designContent := ""
	if designPath != "" {
		resolved := resolvePath(designPath)
		loaded, err := readFileContent(resolved)
		if err != nil {
			return Result{}, &CLIError{Message: "Error: Cannot read design file: " + resolved, Code: 1}
		}
		designContent = loaded
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

	return VerifyTasksFile(content, designContent, requirementsContent), nil
}

// VerifyTasksFile validates the content of a tasks document.
func VerifyTasksFile(content string, designContent string, requirementsContent string) Result {
	errors := make([]shared.Issue, 0, 8)
	warnings := make([]shared.Issue, 0, 4)

	if !strings.Contains(content, "## Overview") {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Overview section not found").
			Set("suggestedFix", "Add ## Overview section with phases list").
			Set("skillDocLink", SKILL_DOC_TASKS))
	}

	phases := phaseHeaderPattern.FindAllString(content, -1)
	if len(phases) == 0 {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "No phase headers found").
			Set("suggestedFix", "Add phase sections using ## Phase 1:, ## Phase 2:, etc.").
			Set("skillDocLink", SKILL_DOC_TASKS))
	} else {
		phaseNumbers := make([]int, 0, len(phases))
		for _, phase := range phases {
			number := 0
			if match := phaseNumberPattern.FindStringSubmatch(phase); match != nil {
				fmt.Sscanf(match[1], "%d", &number)
			}
			phaseNumbers = append(phaseNumbers, number)
		}
		for index, number := range phaseNumbers {
			if number != index+1 {
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Structure Error").
					Set("context", fmt.Sprintf("Phase numbering is not contiguous at phase %d", number)).
					Set("suggestedFix", "Number phases sequentially starting at Phase 1").
					Set("skillDocLink", SKILL_DOC_TASKS))
				break
			}
		}
	}

	hasFinalCheckpoint := false
	for _, phase := range phases {
		if finalCheckpointPattern.MatchString(shared.StripInlineMarkdown(phase)) {
			hasFinalCheckpoint = true
			break
		}
	}

	if len(phases) > 1 && !hasFinalCheckpoint {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Final Checkpoint phase not found").
			Set("suggestedFix", "Add ## Phase X: Final Checkpoint section at end").
			Set("skillDocLink", SKILL_DOC_TASKS))
	}
	if hasFinalCheckpoint && len(phases) > 0 &&
		!finalCheckpointPattern.MatchString(shared.StripInlineMarkdown(phases[len(phases)-1])) {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "Final Checkpoint phase is not last").
			Set("suggestedFix", "Move the Final Checkpoint phase to the end of tasks.md").
			Set("skillDocLink", SKILL_DOC_TASKS))
	}

	lines := splitLines(content)
	taskMatches := taskLinePattern.FindAllString(content, -1)
	linked := make([]string, 0, 8)
	missingTraces := make([]string, 0, 4)
	taskIDs := map[string]bool{}
	dependencyRefs := make([]dependencyRef, 0, 4)
	declaredDesIDs := []string{}
	if designContent != "" {
		declaredDesIDs = shared.ExtractDeclaredDesignElementIDs(designContent)
	}
	validAcceptanceRefs := []string{}
	if requirementsContent != "" {
		validAcceptanceRefs = shared.ExtractAcceptanceCriteriaRefs(requirementsContent)
	}
	implementationTasks := make([]implementationTask, 0, 8)

	if len(taskMatches) == 0 {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Structure Error").
			Set("context", "No tasks in checkbox format found").
			Set("suggestedFix", "Add tasks with format - [ ] 1.1, - [ ] 1.2, etc.").
			Set("skillDocLink", SKILL_DOC_TASKS))
	} else {
		currentPhaseHeader := ""

		for index, line := range lines {
			if phaseNumberPattern.MatchString(line) {
				currentPhaseHeader = line
			}

			taskMatch := taskItemPattern.FindStringSubmatch(line)
			if taskMatch == nil {
				continue
			}

			marker := taskMatch[1]
			taskLabel := strings.TrimSpace(taskMatch[2])
			taskID := taskLabel
			if id := taskIdPattern.FindString(taskLabel); id != "" {
				taskID = id
			}
			lineNumber := index + 1
			taskPhase := ""
			if phase := taskPhasePattern.FindStringSubmatch(taskID); phase != nil {
				taskPhase = phase[1]
			}
			currentPhase := ""
			if phase := phaseNumberPattern.FindStringSubmatch(currentPhaseHeader); phase != nil {
				currentPhase = phase[1]
			}

			if taskIDs[taskID] {
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Format Error").
					Set("context", "Duplicate task id: "+taskID).
					Set("suggestedFix", "Use unique task IDs within tasks.md").
					Set("line", lineNumber).
					Set("skillDocLink", SKILL_DOC_TASKS))
			}
			taskIDs[taskID] = true

			if taskPhase != "" && currentPhase != "" && taskPhase != currentPhase {
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Format Error").
					Set("context", "Task "+taskID+" is under Phase "+currentPhase).
					Set("suggestedFix", "Move task "+taskID+" to Phase "+taskPhase+" or renumber it").
					Set("line", lineNumber).
					Set("skillDocLink", SKILL_DOC_TASKS))
			}

			if marker != " " && marker != "~" && marker != "x" {
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Format Error").
					Set("context", "Invalid status marker detected: '"+marker+"'").
					Set("suggestedFix", "Use only: [ ] (pending), [~] (in progress), [x] (completed)").
					Set("line", lineNumber).
					Set("skillDocLink", SKILL_DOC_TASKS))
			}

			if finalCheckpointPattern.MatchString(shared.StripInlineMarkdown(currentPhaseHeader)) {
				continue
			}

			taskBlock := []string{line}
			for next := index + 1; next < len(lines); next++ {
				if taskStartPattern.MatchString(lines[next]) || phaseHeaderPattern.MatchString(lines[next]) {
					break
				}
				taskBlock = append(taskBlock, lines[next])
			}

			taskText := strings.Join(taskBlock, "\n")
			if depends := dependsPattern.FindStringSubmatch(taskText); depends != nil {
				for _, ref := range taskIdPattern.FindAllString(depends[1], -1) {
					dependencyRefs = append(dependencyRefs, dependencyRef{ref: ref, line: lineNumber})
				}
			}

			traceMatch := implementsPattern.FindStringSubmatch(taskText)
			if traceMatch == nil {
				missingTraces = append(missingTraces, fmt.Sprintf("Line %d: %s", lineNumber, taskID))
				continue
			}

			traceBody := strings.TrimSpace(traceMatch[1])
			desRefs := desRefPattern.FindAllString(traceBody, -1)
			acceptanceRefs := acceptanceRefPattern.FindAllString(traceBody, -1)
			isTestTask := false
			if strings.HasPrefix(strings.ToLower(taskLabelNumberPattern.ReplaceAllString(taskLabel, "")), "test:") {
				isTestTask = true
			}
			if acceptanceTestingPatt.MatchString(shared.StripInlineMarkdown(currentPhaseHeader)) {
				isTestTask = true
			}

			if isTestTask {
				if len(acceptanceRefs) == 0 {
					errors = append(errors, *shared.NewIssue("error").
						Set("errorType", "Traceability Error").
						Set("context", "Test task "+taskID+" does not reference an acceptance criterion").
						Set("suggestedFix", "Add _Implements: REQ-X.Y_ to each test task").
						Set("line", lineNumber).
						Set("skillDocLink", SKILL_DOC_TASKS))
				}
			} else if len(desRefs) == 0 {
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Traceability Error").
					Set("context", "Implementation task "+taskID+" does not reference a design element").
					Set("suggestedFix", "Add at least one valid DES-X reference to implementation task traceability").
					Set("line", lineNumber).
					Set("skillDocLink", SKILL_DOC_TASKS))
			} else {
				implementationTasks = append(implementationTasks, implementationTask{
					id:    taskID,
					title: taskLabel,
					text:  taskText,
					phase: currentPhase,
					line:  lineNumber,
				})
			}

			if requirementsContent != "" {
				for _, reqRef := range acceptanceRefs {
					if !containsString(validAcceptanceRefs, reqRef) {
						errors = append(errors, *shared.NewIssue("error").
							Set("errorType", "Traceability Error").
							Set("context", reqRef+" is referenced in tasks but not defined in requirements.md").
							Set("suggestedFix", "Fix task traceability reference or add "+reqRef+" to requirements.md").
							Set("line", lineNumber).
							Set("skillDocLink", SKILL_DOC_TASKS))
					}
				}
			}

			linked = append(linked, taskID+" → "+traceBody)
		}
	}

	traceabilityRequired := numberedTaskIdsPattern.MatchString(content) || implementsTagPattern.MatchString(content)
	if traceabilityRequired && len(missingTraces) > 0 {
		errors = append(errors, *shared.NewIssue("error").
			Set("errorType", "Traceability Error").
			Set("context", fmt.Sprintf("Missing traceability links for %d task(s)", len(missingTraces))).
			Set("suggestedFix", "Add _Implements: DES-X_ (and optional REQ-X.Y) to each non-checkpoint task").
			Set("skillDocLink", SKILL_DOC_TASKS))
	}

	if designContent != "" {
		implementedDesIDs := []string{}
		for _, match := range implementsPattern.FindAllStringSubmatch(content, -1) {
			implementedDesIDs = append(implementedDesIDs, desRefPattern.FindAllString(match[1], -1)...)
		}

		for _, implementedDesID := range uniqueStrings(implementedDesIDs) {
			if !containsString(declaredDesIDs, implementedDesID) {
				line := shared.FindLineNumber(content, compilePattern(strings.Replace(implementedDesID, ".", `\.`, 1)))
				errors = append(errors, *shared.NewIssue("error").
					Set("errorType", "Traceability Error").
					Set("context", implementedDesID+" is referenced in tasks but not defined in design.md").
					Set("suggestedFix", "Fix task traceability reference or add "+implementedDesID+" to design.md").
					Set("line", line).
					Set("skillDocLink", SKILL_DOC_TASKS))
			}
		}
	}

	designCoverage := extractDesignCoverage(designContent)
	if designCoverage != "" && designCoverage != "Exhaustive" {
		discoveryEvidence := validateDiscoveryEvidence(content)
		firstImplementationTask := implementationTask{}
		hasFirst := len(implementationTasks) > 0
		if hasFirst {
			firstImplementationTask = implementationTasks[0]
		}

		hasLegacyDiscoveryTask := false
		if hasFirst && firstImplementationTask.phase == "1" {
			hasLegacyDiscoveryTask = legacyDiscoveryPattern.MatchString(firstImplementationTask.title + "\n" + firstImplementationTask.text)
		}

		switch {
		case discoveryEvidence.present && !discoveryEvidence.valid:
			errors = append(errors, *shared.NewIssue("error").
				Set("errorType", "Traceability Error").
				Set("context", "Code Anatomy coverage is "+designCoverage+"; Discovery Evidence is incomplete").
				Set("suggestedFix", "For every design Discovery Target, add Target, Result, and Plan impact entries under ## Discovery Evidence").
				Set("line", discoveryEvidence.line).
				Set("skillDocLink", SKILL_DOC_TASKS))
		case !discoveryEvidence.present && hasLegacyDiscoveryTask:
			warnings = append(warnings, *shared.NewIssue("warning").
				Set("line", firstImplementationTask.line).
				Set("message", "Legacy discovery task accepted; new full specs should execute discovery during Phase 3 and record ## Discovery Evidence"))
		case !discoveryEvidence.present:
			errors = append(errors, *shared.NewIssue("error").
				Set("errorType", "Traceability Error").
				Set("context", "Code Anatomy coverage is "+designCoverage+"; completed Phase 3 discovery evidence is missing").
				Set("suggestedFix", "Execute every design Discovery Target before decomposition and record the results under ## Discovery Evidence").
				Set("line", firstImplementationTask.line).
				Set("skillDocLink", SKILL_DOC_TASKS))
		}
	}

	for _, dependency := range dependencyRefs {
		if !taskIDs[dependency.ref] {
			errors = append(errors, *shared.NewIssue("error").
				Set("errorType", "Dependency Error").
				Set("context", "_Depends: "+dependency.ref+"_ references a missing task").
				Set("suggestedFix", "Fix the dependency reference or add the missing task").
				Set("line", dependency.line).
				Set("skillDocLink", SKILL_DOC_TASKS))
		}
	}

	traceabilityReport := shared.NewObject()
	traceabilityReport.Set("linked", linked).
		Set("missingTraces", missingTraces)

	result := Result{Valid: len(errors) == 0, Errors: errors, Warnings: warnings}
	result.set("tasksFound", len(taskMatches)).
		set("phases", phases).
		set("traceabilityReport", traceabilityReport)

	return result
}

// renderTasks renders the tasks validator output.
func renderTasks(result *Result, format string) Output {
	if format == "json" {
		return Output{Stdout: jsonPayload(result) + "\n", ExitCode: exitCode(result)}
	}

	writes := make([]string, 0, 16)
	if !result.Valid {
		writes = append(writes, red("❌ Tasks validation failed:\n")+"\n")
		for index := range result.Errors {
			issue := &result.Errors[index]
			writes = append(writes, shared.FormatError(issue)+"\n", "\n")
		}
		return Output{Stdout: strings.Join(writes, ""), ExitCode: 1}
	}

	linkedCount := 0
	if traceability, ok := result.Extra["traceabilityReport"].(*shared.Object); ok {
		if value, present := traceability.Get("linked"); present {
			linkedCount = len(value.([]string))
		}
	}

	writes = append(writes,
		green("✅ Tasks validation passed.")+"\n",
		fmt.Sprintf("\nFound %d tasks across %d phases.\n", result.extraInt("tasksFound"), len(result.extraStrings("phases"))),
		fmt.Sprintf("Traceability links: %d\n", linkedCount),
	)
	if len(result.Warnings) > 0 {
		writes = append(writes, yellow("\nWarnings:")+"\n")
		for _, warning := range result.Warnings {
			writes = append(writes, "  • "+warning.Message+"\n")
		}
	}

	return Output{Stdout: strings.Join(writes, ""), ExitCode: 0}
}

// discoveryEvidence is the outcome of the discovery evidence validation.
type discoveryEvidence struct {
	present bool
	valid   bool
	line    int
}

// validateDiscoveryEvidence checks the Discovery Evidence section of a tasks
// document.
func validateDiscoveryEvidence(content string) discoveryEvidence {
	lines := splitLines(content)
	headingIndex := -1
	for index, line := range lines {
		if discoveryEvidenceHeader.MatchString(line) {
			headingIndex = index
			break
		}
	}
	if headingIndex == -1 {
		return discoveryEvidence{present: false, valid: false}
	}

	endIndex := len(lines)
	for index := headingIndex + 1; index < len(lines); index++ {
		if nextHeadingPattern.MatchString(lines[index]) {
			endIndex = index
			break
		}
	}

	evidenceLines := lines[headingIndex+1 : endIndex]
	targetIndexes := make([]int, 0, 4)
	for index, line := range evidenceLines {
		if targetLinePattern.MatchString(line) {
			targetIndexes = append(targetIndexes, index)
		}
	}
	if len(targetIndexes) == 0 {
		return discoveryEvidence{present: true, valid: false, line: headingIndex + 1}
	}

	hasInvalidBlock := false
	for index, targetIndex := range targetIndexes {
		nextTargetIndex := len(evidenceLines)
		if index+1 < len(targetIndexes) {
			nextTargetIndex = targetIndexes[index+1]
		}
		block := strings.Join(evidenceLines[targetIndex:nextTargetIndex], "\n")
		if !resultLinePattern.MatchString(block) || !planImpactPattern.MatchString(block) || placeholderPattern.MatchString(block) {
			hasInvalidBlock = true
			break
		}
	}

	return discoveryEvidence{present: true, valid: !hasInvalidBlock, line: headingIndex + 1}
}

// extractDesignCoverage returns the coverage declaration of the Code Anatomy
// section of a design document.
func extractDesignCoverage(designContent string) string {
	if designContent == "" {
		return ""
	}

	location := codeAnatomyHeadingPattern.FindStringIndex(designContent)
	if location == nil {
		return ""
	}

	afterHeading := designContent[location[1]:]
	nextSection := nextSectionPattern.FindStringIndex(afterHeading)
	codeAnatomy := designContent[location[0]:]
	if nextSection != nil {
		codeAnatomy = designContent[location[0] : location[1]+nextSection[0]]
	}

	return extractCoverageValue(codeAnatomy)
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}
