package shared

import (
	"regexp"
	"strings"
)

// EarsCriterionValidation is the outcome of validating a single acceptance
// criterion against the EARS patterns.
type EarsCriterionValidation struct {
	Valid   bool
	Pattern string
	Errors  []string
}

var (
	whitespaceRunPattern = regexp.MustCompile(jsSpace + `+`)
	shallPattern         = regexp.MustCompile(`\bSHALL\b`)

	earsPatterns = []struct {
		name    string
		pattern *regexp.Regexp
	}{
		{"ubiquitous", regexp.MustCompile(`^THE` + jsSpace + `+.+` + jsSpace + `+SHALL` + jsSpace + `+.+\.$`)},
		{"event-driven", regexp.MustCompile(`^WHEN` + jsSpace + `+.+,` + jsSpace + `+THEN` + jsSpace + `+the` + jsSpace + `+.+` + jsSpace + `+SHALL` + jsSpace + `+.+\.$`)},
		{"unwanted", regexp.MustCompile(`^IF` + jsSpace + `+.+,` + jsSpace + `+THEN` + jsSpace + `+the` + jsSpace + `+.+` + jsSpace + `+SHALL` + jsSpace + `+.+\.$`)},
		{"state-driven", regexp.MustCompile(`^WHILE` + jsSpace + `+.+,` + jsSpace + `+the` + jsSpace + `+.+` + jsSpace + `+SHALL` + jsSpace + `+.+\.$`)},
		{"optional", regexp.MustCompile(`^WHERE` + jsSpace + `+.+,` + jsSpace + `+the` + jsSpace + `+.+` + jsSpace + `+SHALL` + jsSpace + `+.+\.$`)},
		{"complex", regexp.MustCompile(`^WHILE` + jsSpace + `+.+,` + jsSpace + `+WHEN` + jsSpace + `+.+,` + jsSpace + `+THEN` + jsSpace + `+the` + jsSpace + `+.+` + jsSpace + `+SHALL` + jsSpace + `+.+\.$`)},
	}
)

// ValidateEarsCriterion validates a single acceptance criterion against the
// canonical EARS syntax.
func ValidateEarsCriterion(text string) EarsCriterionValidation {
	errors := make([]string, 0, 3)
	normalized := whitespaceRunPattern.ReplaceAllString(strings.TrimSpace(text), " ")

	if !strings.HasSuffix(normalized, ".") {
		errors = append(errors, "Acceptance criterion must be a single sentence ending with a period")
	}

	if len(shallPattern.FindAllString(normalized, -1)) != 1 {
		errors = append(errors, "Acceptance criterion must include exactly one SHALL")
	}

	matched := ""
	for _, candidate := range earsPatterns {
		if candidate.pattern.MatchString(normalized) {
			matched = candidate.name
			break
		}
	}
	if matched == "" {
		errors = append(errors, "Acceptance criterion must match a valid EARS pattern with a named system subject")
	}

	return EarsCriterionValidation{
		Valid:   len(errors) == 0,
		Pattern: matched,
		Errors:  errors,
	}
}
