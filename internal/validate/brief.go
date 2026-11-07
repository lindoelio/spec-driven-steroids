package validate

import (
	"fmt"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

// SKILL_DOC_BRIEF points at the brief planner skill.
const SKILL_DOC_BRIEF = "skills/spec-driven-brief-planner/SKILL.md"

// RequiredBriefSections are the sections every brief has to declare.
var RequiredBriefSections = []string{
	"Intent",
	"Non-Goals",
	"Acceptance Criteria",
	"Repository Evidence",
	"Implementation Plan",
	"Final Verification",
}

var (
	laneDeclarationPattern = regexp.MustCompile(`(?mi)^\*\*Lane:\*\*\s+brief\s*$`)
	bulletPattern          = regexp.MustCompile(`^-\s+\S`)
	acceptanceBulletPatt   = regexp.MustCompile(`^-\s+REQ-\d+:\s+.+$`)
	acceptanceItemPattern  = regexp.MustCompile(`^-\s+(REQ-(\d+)):\s+([^\r\n]+)$`)
	evidenceEntryPattern   = regexp.MustCompile("^-\\s+(Existing|New):\\s+`([^`]+)`\\s+-\\s+(.+)$")
	backtickPathPattern    = regexp.MustCompile("`[^`]+`")
	backtickCommandPattern = regexp.MustCompile("`[^`]*[^\\s`][^`]*`")
	checkOutcomePattern    = regexp.MustCompile(`(?i)^Check:\s*\S.*?\s*(?:=>|→)\s*\S.*$`)
	briefTaskStartPattern  = regexp.MustCompile(`^-\s+\[([^\]])\]\s+(\d+)\.\s+([^\r\n]+)$`)
	taskBulletPattern      = regexp.MustCompile(`^-\s+\[`)
	changeFieldPattern     = regexp.MustCompile(`(?im)^[ \t]+-\s+Change:\s+(.+)$`)
	filesFieldPattern      = regexp.MustCompile(`(?im)^[ \t]+-\s+Files:\s+(.+)$`)
	verifyFieldPattern     = regexp.MustCompile(`(?im)^[ \t]+-\s+Verify:\s+(.+)$`)
	backtickPathGlobal     = regexp.MustCompile("`([^`]+)`")
	todoPattern            = regexp.MustCompile(`(?i)\b(?:TODO|TBD|TBA|FIXME)\b`)
	templateTokenPattern   = regexp.MustCompile(`(?i)<\s*(?:problem, expected outcome, and scope boundary|explicitly excluded behavior|observable outcome|evidence and role in the change|planned role|concrete action|exact scoped change|focused command or observable check|optional low or medium risk|final command or observable check|path|slug|describe[^>]*|fill(?: in)?[^>]*)\s*>`)
	desIdPattern           = regexp.MustCompile(`(?i)DES-\d+`)
	decimalReqIdPattern    = regexp.MustCompile(`(?i)REQ-\d+\.\d+`)
	briefReqRefPattern     = regexp.MustCompile(`REQ-\d+`)
	briefHeadingPattern    = regexp.MustCompile(`^##\s+([^\r\n]+?)\s*$`)
)

// briefSection is a section of a brief document.
type briefSection struct {
	content     string
	headingLine int
	index       int
}

// briefTask is an implementation task of a brief document.
type briefTask struct {
	id              int
	title           string
	line            int
	requirementRefs []string
}

// ValidateBrief validates a brief.md file.
func ValidateBrief(path string) (Result, error) {
	fullPath := resolvePath(path)
	content, err := readFileContent(fullPath)
	if err != nil {
		return Result{}, &CLIError{Message: "Error: Cannot read file: " + fullPath, Code: 1}
	}
	return VerifyBriefFile(content), nil
}

// VerifyBriefFile validates the content of a brief document.
func VerifyBriefFile(content string) Result {
	errors := make([]shared.Issue, 0, 8)
	warnings := make([]shared.Issue, 0, 4)
	requirementsFound := make([]string, 0, 5)
	tasksFound := make([]*shared.Object, 0, 8)
	coveredRequirements := newOrderedStringSet()
	evidencePaths := newOrderedStringSet()

	firstNonEmptyLine := ""
	for _, line := range splitLines(content) {
		if strings.TrimSpace(line) != "" {
			firstNonEmptyLine = strings.TrimSpace(line)
			break
		}
	}
	if firstNonEmptyLine != "# Change Brief" {
		addBriefError(&errors, "Structure Error", "Document must start with # Change Brief", "Add # Change Brief as the first non-empty line", 0)
	}

	if !laneDeclarationPattern.MatchString(content) {
		addBriefError(&errors, "Structure Error", "Brief lane declaration is missing or invalid", "Add **Lane:** brief below the document title", 0)
	}

	sections := map[string]*briefSection{}
	for _, sectionName := range RequiredBriefSections {
		section := extractBriefSection(content, sectionName)
		if section == nil {
			addBriefError(&errors, "Structure Error", sectionName+" section not found", "Add ## "+sectionName, 0)
			continue
		}
		sections[sectionName] = section
	}

	allowedSections := newOrderedStringSet()
	for _, sectionName := range RequiredBriefSections {
		allowedSections.add(sectionName)
	}
	allowedSections.add("Risks")

	for index, line := range splitLines(content) {
		heading := briefHeadingPattern.FindStringSubmatch(line)
		if heading != nil && !allowedSections.has(heading[1]) {
			addBriefError(&errors, "Structure Error", "Unsupported section: "+heading[1], "Use only the required brief sections and optional ## Risks", index+1)
		}
	}

	previousSectionIndex := -1
	for _, sectionName := range RequiredBriefSections {
		section := sections[sectionName]
		if section == nil {
			continue
		}
		if section.index < previousSectionIndex {
			addBriefError(&errors, "Structure Error", sectionName+" section is out of order", "Place ## "+sectionName+" after the preceding required section", section.headingLine)
		}
		if section.index > previousSectionIndex {
			previousSectionIndex = section.index
		}
	}

	risksSection := extractBriefSection(content, "Risks")
	implementationSection := sections["Implementation Plan"]
	finalVerificationSection := sections["Final Verification"]
	if risksSection != nil && implementationSection != nil && finalVerificationSection != nil &&
		(risksSection.index < implementationSection.index || risksSection.index > finalVerificationSection.index) {
		addBriefError(&errors, "Structure Error", "Risks section is out of order", "Place optional ## Risks between ## Implementation Plan and ## Final Verification", risksSection.headingLine)
	}

	if intentSection := sections["Intent"]; intentSection != nil {
		intent := strings.TrimSpace(intentSection.content)
		if intent == "" || hasProsePlaceholder(intent) {
			addBriefError(&errors, "Placeholder Error", "Intent must contain resolved change intent", "Replace placeholders with the concrete problem, outcome, and scope", intentSection.headingLine+1)
		}
	}

	if nonGoalsSection := sections["Non-Goals"]; nonGoalsSection != nil {
		nonGoals := make([]string, 0, 4)
		for _, line := range splitLines(nonGoalsSection.content) {
			if bulletPattern.MatchString(line) {
				nonGoals = append(nonGoals, line)
			}
		}
		invalid := len(nonGoals) == 0
		for _, goal := range nonGoals {
			if hasProsePlaceholder(goal) {
				invalid = true
				break
			}
		}
		if invalid {
			addBriefError(&errors, "Format Error", "Non-Goals must contain at least one resolved bullet", "Add one or more concrete out-of-scope bullets", nonGoalsSection.headingLine+1)
		}
	}

	if acceptanceSection := sections["Acceptance Criteria"]; acceptanceSection != nil {
		lines := splitLines(acceptanceSection.content)
		for index, line := range lines {
			if bulletPattern.MatchString(line) && !acceptanceBulletPatt.MatchString(line) {
				addBriefError(&errors, "Format Error", "Invalid acceptance criterion: "+line, "Use - REQ-N: <observable outcome>", acceptanceSection.headingLine+index+1)
				continue
			}
			match := acceptanceItemPattern.FindStringSubmatch(line)
			if match == nil {
				continue
			}
			requirementsFound = append(requirementsFound, match[1])
			if hasProsePlaceholder(match[3]) {
				addBriefError(&errors, "Placeholder Error", match[1]+" contains unresolved placeholder text", "Replace the placeholder with an observable outcome", acceptanceSection.headingLine+index+1)
			}
		}

		if len(requirementsFound) < 1 || len(requirementsFound) > 5 {
			addBriefError(&errors, "Format Error", fmt.Sprintf("Brief must contain 1-5 requirements; found %d", len(requirementsFound)), "Add between 1 and 5 acceptance criteria using - REQ-N: <observable outcome>", acceptanceSection.headingLine+1)
		}

		for index, requirement := range requirementsFound {
			expected := fmt.Sprintf("REQ-%d", index+1)
			if requirement != expected {
				addBriefError(&errors, "Format Error", "Requirement numbering is not contiguous at "+requirement, "Renumber requirements sequentially starting at "+expected, acceptanceSection.headingLine+1)
				break
			}
		}
	}

	if evidenceSection := sections["Repository Evidence"]; evidenceSection != nil {
		evidenceLines := make([]string, 0, 4)
		for _, line := range splitLines(evidenceSection.content) {
			if bulletPattern.MatchString(line) {
				evidenceLines = append(evidenceLines, line)
			}
		}
		if len(evidenceLines) == 0 {
			addBriefError(&errors, "Format Error", "Repository Evidence has no entries", "Add at least one Existing or New path entry", evidenceSection.headingLine+1)
		}
		for index, entry := range evidenceLines {
			match := evidenceEntryPattern.FindStringSubmatch(entry)
			if match == nil || hasProsePlaceholder(match[2]) || hasProsePlaceholder(match[3]) {
				addBriefError(&errors, "Format Error", "Invalid Repository Evidence entry: "+entry, "Use - Existing: `path` - evidence or - New: `path` - purpose", evidenceSection.headingLine+index+1)
				continue
			}
			evidencePaths.add(normalizeEvidencePath(match[2]))
		}
	}

	if implementationSection != nil {
		lines := splitLines(implementationSection.content)
		type taskStart struct {
			lineIndex int
			marker    string
			id        int
			title     string
		}
		taskStarts := make([]taskStart, 0, 8)

		for index, line := range lines {
			match := briefTaskStartPattern.FindStringSubmatch(line)
			if taskBulletPattern.MatchString(line) && match == nil {
				addBriefError(&errors, "Format Error", "Invalid implementation task: "+line, "Use - [ ] N. <action title>", implementationSection.headingLine+index+1)
			}
			if match == nil {
				continue
			}
			id, _ := strconv.Atoi(match[2])
			taskStarts = append(taskStarts, taskStart{
				lineIndex: index,
				marker:    match[1],
				id:        id,
				title:     strings.TrimSpace(match[3]),
			})
		}

		if len(taskStarts) < 1 || len(taskStarts) > 8 {
			addBriefError(&errors, "Format Error", fmt.Sprintf("Brief must contain 1-8 tasks; found %d", len(taskStarts)), "Add between 1 and 8 checkbox tasks", implementationSection.headingLine+1)
		}

		for index, task := range taskStarts {
			taskLine := implementationSection.headingLine + task.lineIndex + 1
			nextStart := len(lines)
			if index+1 < len(taskStarts) {
				nextStart = taskStarts[index+1].lineIndex
			}
			taskBlock := strings.Join(lines[task.lineIndex:nextStart], "\n")

			if task.marker != " " && task.marker != "~" && task.marker != "x" {
				addBriefError(&errors, "Format Error", fmt.Sprintf("Invalid status marker for task %d: '%s'", task.id, task.marker), "Use [ ], [~], or [x]", taskLine)
			}
			if task.id != index+1 {
				addBriefError(&errors, "Format Error", fmt.Sprintf("Task numbering is not contiguous at %d", task.id), fmt.Sprintf("Renumber this task to %d", index+1), taskLine)
			}
			if hasProsePlaceholder(task.title) {
				addBriefError(&errors, "Placeholder Error", fmt.Sprintf("Task %d title contains unresolved placeholder text", task.id), "Replace the placeholder with a concrete action", taskLine)
			}

			change := firstCapture(changeFieldPattern, taskBlock)
			files := firstCapture(filesFieldPattern, taskBlock)
			verify := firstCapture(verifyFieldPattern, taskBlock)
			implementsMatch := implementsPattern.FindStringSubmatch(taskBlock)

			if change == "" || hasProsePlaceholder(change) {
				addBriefError(&errors, "Format Error", fmt.Sprintf("Task %d is missing a resolved Change field", task.id), "Add - Change: <exact scoped change>", taskLine)
			}
			if files == "" || !backtickPathPattern.MatchString(files) || hasProsePlaceholder(files) {
				addBriefError(&errors, "Format Error", fmt.Sprintf("Task %d is missing valid Files", task.id), "Add - Files: with one or more backticked paths", taskLine)
			} else {
				taskPaths := newOrderedStringSet()
				for _, match := range backtickPathGlobal.FindAllStringSubmatch(files, -1) {
					taskPaths.add(normalizeEvidencePath(match[1]))
				}
				for _, filePath := range taskPaths.values {
					if !evidencePaths.has(filePath) {
						warnings = append(warnings, *shared.NewIssue("warning").
							Set("line", taskLine).
							Set("message", fmt.Sprintf("Repository Evidence: task %d references %s without an Existing or New entry", task.id, filePath)))
					}
				}
			}
			if verify == "" || hasProsePlaceholder(verify) {
				addBriefError(&errors, "Format Error", fmt.Sprintf("Task %d is missing a resolved Verify field", task.id), "Add - Verify: with a command or observable check", taskLine)
			} else if !backtickCommandPattern.MatchString(verify) && !checkOutcomePattern.MatchString(verify) {
				warnings = append(warnings, *shared.NewIssue("warning").
					Set("line", taskLine).
					Set("message", fmt.Sprintf("Verification signal: task %d should use a backticked command or Check: <action> => <observable outcome>; this heuristic does not establish correctness", task.id)))
			}
			if implementsMatch == nil {
				addBriefError(&errors, "Traceability Error", fmt.Sprintf("Task %d is missing _Implements", task.id), "Add _Implements: REQ-N_", taskLine)
			}

			refs := []string{}
			if implementsMatch != nil {
				refs = briefReqRefPattern.FindAllString(implementsMatch[1], -1)
			}
			if implementsMatch != nil && len(refs) == 0 {
				addBriefError(&errors, "Traceability Error", fmt.Sprintf("Task %d does not reference a brief requirement", task.id), "Add at least one REQ-N reference", taskLine)
			}
			if implementsMatch != nil && desIdPattern.MatchString(implementsMatch[1]) {
				addBriefError(&errors, "Traceability Error", fmt.Sprintf("Task %d references DES IDs in the brief lane", task.id), "Remove DES references; brief tasks trace directly to REQ-N", taskLine)
			}
			if implementsMatch != nil && decimalReqIdPattern.MatchString(implementsMatch[1]) {
				addBriefError(&errors, "Traceability Error", fmt.Sprintf("Task %d uses full-lane acceptance-criterion IDs", task.id), "Use brief-level REQ-N references without decimal suffixes", taskLine)
			}
			for _, ref := range refs {
				if !containsString(requirementsFound, ref) {
					addBriefError(&errors, "Traceability Error", fmt.Sprintf("%s is referenced by task %d but not declared", ref, task.id), "Declare "+ref+" or correct the task reference", taskLine)
				} else {
					coveredRequirements.add(ref)
				}
			}

			taskObject := shared.NewObject()
			taskObject.Set("id", task.id).
				Set("title", task.title).
				Set("line", taskLine).
				Set("requirementRefs", refs)
			tasksFound = append(tasksFound, taskObject)
		}
	}

	for _, requirement := range requirementsFound {
		if !coveredRequirements.has(requirement) {
			addBriefError(&errors, "Traceability Error", requirement+" is not covered by an implementation task", "Add "+requirement+" to a task _Implements tag", 0)
		}
	}

	if risksSection != nil && (strings.TrimSpace(risksSection.content) == "" || hasProsePlaceholder(risksSection.content)) {
		addBriefError(&errors, "Placeholder Error", "Risks is empty or contains unresolved placeholder text", "Resolve or remove the optional Risks section", risksSection.headingLine+1)
	}

	if finalVerificationSection != nil {
		checks := make([]string, 0, 4)
		for _, line := range splitLines(finalVerificationSection.content) {
			if bulletPattern.MatchString(line) {
				checks = append(checks, line)
			}
		}
		invalid := len(checks) == 0
		for _, check := range checks {
			if hasProsePlaceholder(check) {
				invalid = true
				break
			}
		}
		if invalid {
			addBriefError(&errors, "Format Error", "Final Verification must contain at least one resolved check", "Add one or more verification command or observable-check bullets", finalVerificationSection.headingLine+1)
		}
	}

	result := Result{Valid: len(errors) == 0, Errors: errors, Warnings: warnings}
	result.set("requirementsFound", requirementsFound).
		set("tasksFound", tasksFound).
		set("coveredRequirements", coveredRequirements.values)

	return result
}

// renderBrief renders the brief validator output.
func renderBrief(result *Result, format string) Output {
	if format == "json" {
		return Output{Stdout: jsonPayload(result) + "\n", ExitCode: exitCode(result)}
	}

	writes := make([]string, 0, 16)
	if !result.Valid {
		writes = append(writes, red("❌ Brief validation failed:\n")+"\n")
		for index := range result.Errors {
			issue := &result.Errors[index]
			writes = append(writes, shared.FormatError(issue)+"\n", "\n")
		}
	} else {
		writes = append(writes,
			green("✅ Brief validation passed.")+"\n",
			fmt.Sprintf("\nFound %d requirements and %d tasks.\n", len(result.extraStrings("requirementsFound")), len(result.extraObjects("tasksFound"))),
		)
	}

	for _, warning := range result.Warnings {
		if warning.Line > 0 {
			writes = append(writes, yellow(fmt.Sprintf("Warning (line %d): %s", warning.Line, warning.Message))+"\n")
			continue
		}
		writes = append(writes, yellow("Warning: "+warning.Message)+"\n")
	}

	return Output{Stdout: strings.Join(writes, ""), ExitCode: exitCode(result)}
}

// addBriefError appends an error to the error list of the brief validator.
func addBriefError(errors *[]shared.Issue, errorType string, context string, suggestedFix string, line int) {
	issue := shared.NewIssue("error").
		Set("errorType", errorType).
		Set("context", context).
		Set("suggestedFix", suggestedFix)
	if line > 0 {
		issue.Set("line", line)
	}
	issue.Set("skillDocLink", SKILL_DOC_BRIEF)
	*errors = append(*errors, *issue)
}

// extractBriefSection returns a section of a brief document.
func extractBriefSection(content string, name string) *briefSection {
	lines := splitLines(content)
	headingPattern := regexp.MustCompile(`(?i)^##\s+` + regexp.QuoteMeta(name) + `\s*$`)

	headingIndex := -1
	for index, line := range lines {
		if headingPattern.MatchString(line) {
			headingIndex = index
			break
		}
	}
	if headingIndex == -1 {
		return nil
	}

	endIndex := len(lines)
	for index := headingIndex + 1; index < len(lines); index++ {
		if nextHeadingPattern.MatchString(lines[index]) {
			endIndex = index
			break
		}
	}

	return &briefSection{
		content:     strings.Join(lines[headingIndex+1:endIndex], "\n"),
		headingLine: headingIndex + 1,
		index:       headingIndex,
	}
}

// hasProsePlaceholder reports whether a value still holds a template
// placeholder.
func hasProsePlaceholder(value string) bool {
	return todoPattern.MatchString(value) || templateTokenPattern.MatchString(value)
}

// normalizeEvidencePath normalizes a repository path the way the oracle does.
func normalizeEvidencePath(value string) string {
	return path.Clean(strings.ReplaceAll(value, `\`, "/"))
}

// firstCapture returns the first capture group of a pattern.
func firstCapture(pattern *regexp.Regexp, value string) string {
	match := pattern.FindStringSubmatch(value)
	if match == nil {
		return ""
	}
	return match[1]
}

// orderedStringSet keeps the insertion order of its values.
type orderedStringSet struct {
	values []string
	seen   map[string]bool
}

func newOrderedStringSet() *orderedStringSet {
	return &orderedStringSet{seen: map[string]bool{}}
}

func (s *orderedStringSet) add(value string) {
	if s.seen == nil {
		s.seen = map[string]bool{}
	}
	if s.seen[value] {
		return
	}
	s.seen[value] = true
	s.values = append(s.values, value)
}

func (s *orderedStringSet) has(value string) bool {
	return s.seen[value]
}
