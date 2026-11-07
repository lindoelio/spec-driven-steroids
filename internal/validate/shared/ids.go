package shared

import (
	"regexp"
	"strings"
)

// jsSpace matches the character class of the JavaScript \s escape. The Go
// \s class only covers ASCII, while JavaScript also matches the Unicode
// space separators.
const jsSpace = `[\t\n\v\f\r \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]`

var (
	requirementHeadingPattern = regexp.MustCompile(`(?im)^###\s+Requirement\s+(\d+)\s*:`)
	explicitReqHeadingPattern = regexp.MustCompile(`(?im)^###\s+(REQ-\d+)\b`)
	requirementRefPattern     = regexp.MustCompile(`REQ-\d+(?:\.\d+)?`)
	designHeadingPattern      = regexp.MustCompile(`(?im)^###\s+(DES-\d+)\b`)
	designRefPattern          = regexp.MustCompile(`DES-\d+`)
	explicitCriteriaPattern   = regexp.MustCompile(`REQ-\d+\.\d+`)
	criteriaHeadingPattern    = regexp.MustCompile(`(?i)^###\s+(?:Requirement\s+(\d+)\s*:|(REQ-(\d+))\b)`)
	numberedCriteriaPattern   = regexp.MustCompile(`^\s*(\d+)\.(\d+)\s+`)
	simpleCriteriaPattern     = regexp.MustCompile(`^\s*(\d+)\s+`)
)

// FindLineNumber returns the 1-based number of the first line matching the
// pattern, or -1 when no line matches.
func FindLineNumber(content string, pattern *regexp.Regexp) int {
	for index, line := range splitLines(content) {
		if pattern.MatchString(line) {
			return index + 1
		}
	}
	return -1
}

// ExtractDeclaredRequirementIDs returns the REQ identifiers declared by
// headings of a requirements document.
func ExtractDeclaredRequirementIDs(content string) []string {
	ids := make([]string, 0, 8)
	for _, match := range requirementHeadingPattern.FindAllStringSubmatch(content, -1) {
		ids = append(ids, "REQ-"+match[1])
	}
	for _, match := range explicitReqHeadingPattern.FindAllStringSubmatch(content, -1) {
		ids = append(ids, match[1])
	}
	return unique(ids)
}

// ExtractRequirementRefs returns every REQ reference of a document.
func ExtractRequirementRefs(content string) []string {
	return unique(requirementRefPattern.FindAllString(content, -1))
}

// ExtractDesignElementIDs returns the design element identifiers declared by
// headings of a design document.
func ExtractDesignElementIDs(content string) []string {
	return ExtractDeclaredDesignElementIDs(content)
}

// ExtractDeclaredDesignElementIDs returns the design element identifiers
// declared by headings of a design document.
func ExtractDeclaredDesignElementIDs(content string) []string {
	ids := make([]string, 0, 8)
	for _, match := range designHeadingPattern.FindAllStringSubmatch(content, -1) {
		ids = append(ids, match[1])
	}
	return unique(ids)
}

// ExtractDesignElementRefs returns every design element reference of a
// document.
func ExtractDesignElementRefs(content string) []string {
	return unique(designRefPattern.FindAllString(content, -1))
}

// ExtractAcceptanceCriteriaRefs returns every acceptance criterion reference
// of a requirements document, both the explicitly written ones and the ones
// implied by the numbered criteria of each requirement.
func ExtractAcceptanceCriteriaRefs(content string) []string {
	refs := make([]string, 0, 16)
	refs = append(refs, explicitCriteriaPattern.FindAllString(content, -1)...)

	currentReq := ""
	for _, line := range splitLines(content) {
		heading := criteriaHeadingPattern.FindStringSubmatch(line)
		if heading != nil {
			currentReq = heading[1]
			if currentReq == "" {
				currentReq = heading[3]
			}
			continue
		}

		if currentReq == "" {
			continue
		}

		if criteria := numberedCriteriaPattern.FindStringSubmatch(line); criteria != nil {
			refs = append(refs, "REQ-"+criteria[1]+"."+criteria[2])
			continue
		}
		if simple := simpleCriteriaPattern.FindStringSubmatch(line); simple != nil {
			refs = append(refs, "REQ-"+currentReq+"."+simple[1])
		}
	}

	return unique(refs)
}

// splitLines splits a document into lines the way JavaScript splits a string
// on "\n".
func splitLines(content string) []string {
	return strings.Split(content, "\n")
}

func unique(values []string) []string {
	seen := make(map[string]bool, len(values))
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
