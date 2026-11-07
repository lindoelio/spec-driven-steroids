package shared

import (
	"regexp"
	"strings"
)

// TraceabilityReport links design elements to the requirements they implement.
type TraceabilityReport struct {
	Linked         []string
	Orphaned       []string
	InvalidReqRefs []string
}

var (
	inlineMarkdownPattern = regexp.MustCompile("[*_`]+")
	implementsLinePattern = regexp.MustCompile(`(?i)_Implements:[^\n]+`)
	traceRefPattern       = regexp.MustCompile(`REQ-\d+(?:\.\d+)?`)
	nextDesignHeading     = regexp.MustCompile(`^###\s+DES-\d+\b`)
)

// StripInlineMarkdown removes the inline markdown markers of a value.
func StripInlineMarkdown(value string) string {
	return inlineMarkdownPattern.ReplaceAllString(value, "")
}

// BuildTraceabilityReport maps every declared design element to the
// requirements it implements.
func BuildTraceabilityReport(content string, validReqRefs []string) TraceabilityReport {
	linked := make([]string, 0, 8)
	orphaned := make([]string, 0, 4)
	invalidReqRefs := make([]string, 0, 4)

	desIDs := ExtractDeclaredDesignElementIDs(content)
	lines := splitLines(content)

	for _, desID := range desIDs {
		headingPattern := regexp.MustCompile(`^###\s+` + regexp.QuoteMeta(desID) + `\b`)
		start := -1
		for index, line := range lines {
			if headingPattern.MatchString(line) {
				start = index
				break
			}
		}

		endLineIndex := -1
		for index, line := range lines {
			if index > start && nextDesignHeading.MatchString(line) {
				endLineIndex = index
				break
			}
		}
		end := len(lines)
		if endLineIndex != -1 {
			end = endLineIndex
		}

		section := ""
		if start >= 0 && start <= end {
			section = strings.Join(lines[start:end], "\n")
		}

		implementsLine := ""
		if match := implementsLinePattern.FindString(section); match != "" {
			implementsLine = match
		}

		reqRefs := traceRefPattern.FindAllString(implementsLine, -1)
		if len(reqRefs) == 0 {
			orphaned = append(orphaned, desID)
			continue
		}

		for _, reqRef := range reqRefs {
			linked = append(linked, desID+" -> "+reqRef)
			if len(validReqRefs) > 0 && !containsString(validReqRefs, reqRef) {
				invalidReqRefs = append(invalidReqRefs, desID+" -> "+reqRef)
			}
		}
	}

	return TraceabilityReport{Linked: linked, Orphaned: orphaned, InvalidReqRefs: invalidReqRefs}
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}
