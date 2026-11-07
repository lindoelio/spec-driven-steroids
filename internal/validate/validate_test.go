package validate

import (
	"strings"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/validate/shared"
)

func TestValidateEarsCriterion(t *testing.T) {
	cases := []struct {
		name    string
		text    string
		valid   bool
		pattern string
	}{
		{"ubiquitous", "THE system SHALL persist the change.", true, "ubiquitous"},
		{"event-driven", "WHEN a spec changes, THEN the validator SHALL report the failure.", true, "event-driven"},
		{"unwanted", "IF the file is missing, THEN the validator SHALL fail the run.", true, "unwanted"},
		{"state-driven", "WHILE the spec is open, the validator SHALL report the failure.", true, "state-driven"},
		{"optional", "WHERE the file exists, the validator SHALL report the failure.", true, "optional"},
		{"complex", "WHILE the spec is open, WHEN a file changes, THEN the validator SHALL report the failure.", true, "complex"},
		{"missing period", "THE system SHALL persist the change", false, ""},
		{"two shalls", "THE system SHALL persist the change SHALL report it.", false, "ubiquitous"},
		{"no shall", "THE system persists the change.", false, ""},
		{"not ears", "The system persists the change.", false, ""},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			result := shared.ValidateEarsCriterion(testCase.text)
			if result.Valid != testCase.valid {
				t.Fatalf("valid = %v, want %v (%v)", result.Valid, testCase.valid, result.Errors)
			}
			if result.Pattern != testCase.pattern {
				t.Fatalf("pattern = %q, want %q", result.Pattern, testCase.pattern)
			}
		})
	}
}

func TestVerifyRequirementsFileReportsNumberingErrors(t *testing.T) {
	content := `# Requirements

## Requirements

### REQ-1: Login

#### Acceptance Criteria

1.1 WHEN the user signs in, THEN the system SHALL create a session.

### REQ-2: Logout

#### Acceptance Criteria

2.1 WHEN the user signs out, THEN the system SHALL drop the session.
`

	result := VerifyRequirementsFile(content)
	if !result.Valid {
		t.Fatalf("expected a valid result, got %d errors", len(result.Errors))
	}
	if got := len(result.extraStrings("requirementsFound")); got != 2 {
		t.Fatalf("requirementsFound = %d, want 2", got)
	}

	broken := strings.Replace(content, "2.1 WHEN", "3.1 WHEN", 1)
	result = VerifyRequirementsFile(broken)
	if result.Valid {
		t.Fatal("expected an invalid result")
	}
	if len(result.Errors) != 1 {
		t.Fatalf("errors = %d, want 1", len(result.Errors))
	}
	if !strings.Contains(result.Errors[0].Context, "does not match REQ-2") {
		t.Fatalf("unexpected context %q", result.Errors[0].Context)
	}
	if result.Errors[0].Line != 15 {
		t.Fatalf("line = %d, want 15", result.Errors[0].Line)
	}
}

func TestResultJSONKeepsTheKeyOrderOfTheOracle(t *testing.T) {
	result := VerifyRequirementsFile("# Requirements\n")
	payload := string(mustMarshal(&result))

	want := []string{
		`"valid"`,
		`"errors"`,
		`"warnings"`,
		`"requirementsFound"`,
		`"earsPatterns"`,
	}
	position := 0
	for _, key := range want {
		index := strings.Index(payload[position:], key)
		if index < 0 {
			t.Fatalf("the key %s is missing or out of order in:\n%s", key, payload)
		}
		position += index
	}
}

func TestDetectSpecLane(t *testing.T) {
	if lane := DetectSpecLane([]string{"brief.md"}); lane != "brief" {
		t.Fatalf("lane = %q, want brief", lane)
	}
	if lane := DetectSpecLane([]string{"requirements.md", "design.md", "tasks.md"}); lane != "full" {
		t.Fatalf("lane = %q, want full", lane)
	}
	if lane := DetectSpecLane([]string{"notes.md"}); lane != "full" {
		t.Fatalf("lane = %q, want full", lane)
	}
}

func TestFormatErrorRendersTheOracleLayout(t *testing.T) {
	issue := shared.NewIssue("error").
		Set("errorType", "Format Error").
		Set("context", "No REQ-X IDs found").
		Set("suggestedFix", "Number each requirement with REQ-1, REQ-2, etc.").
		Set("skillDocLink", "skills/spec-driven-requirements-writer/SKILL.md")

	want := "[Format Error] → No REQ-X IDs found → Number each requirement with REQ-1, REQ-2, etc.\n   See: skills/spec-driven-requirements-writer/SKILL.md"
	if got := shared.FormatError(issue); got != want {
		t.Fatalf("format error =\n%q\nwant\n%q", got, want)
	}
}

func TestVerifyBriefFileAcceptsACompleteBrief(t *testing.T) {
	content := `# Change Brief

**Lane:** brief

## Intent

Validate a lightweight approved plan.

## Non-Goals

- Changing full-lane validation.

## Acceptance Criteria

- REQ-1: The brief is validated before implementation.

## Repository Evidence

- Existing: ` + "`src/validate.ts`" + ` - Validation entry point.

## Implementation Plan

- [ ] 1. Validate the brief
  - Change: Add deterministic brief validation.
  - Files: ` + "`src/validate.ts`" + `
  - Verify: ` + "`pnpm test`" + `
  - _Implements: REQ-1_

## Final Verification

- ` + "`pnpm test`" + `
`

	result := VerifyBriefFile(content)
	if !result.Valid {
		t.Fatalf("expected a valid result, got %d errors", len(result.Errors))
	}
	if len(result.Warnings) != 0 {
		t.Fatalf("warnings = %d, want 0", len(result.Warnings))
	}
}

func TestRenderReportsTheExitCodeOfTheOracle(t *testing.T) {
	result := VerifyRequirementsFile("# Requirements\n")
	output := Render("requirements", &result, "text", nil)
	if output.ExitCode != 1 {
		t.Fatalf("exit code = %d, want 1", output.ExitCode)
	}
	if !strings.HasPrefix(output.Stdout, "❌ Requirements validation failed:\n") {
		t.Fatalf("unexpected output %q", output.Stdout)
	}
}
