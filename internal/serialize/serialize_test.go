package serialize

import (
	"strings"
	"testing"
)

// TestTheFrontmatterKeepsTheSourceOrder checks that the frontmatter fields
// keep the order of the source document.
//
// The derived artifact has to be reproducible: the same source always
// produces the same bytes.
func TestTheFrontmatterKeepsTheSourceOrder(t *testing.T) {
	source := "---\nname: spec-driven\ndescription: A workflow\nmode: primary\ntools: a, b\n---\n\n# Body\n"

	for attempt := 0; attempt < 20; attempt++ {
		parsed := ParseSource(source)
		order := strings.Join(parsed.FrontmatterOrder, ",")
		if order != "name,description,mode,tools" {
			t.Fatalf("the frontmatter order is %q, want %q", order, "name,description,mode,tools")
		}
	}
}

// TestTheFrontmatterRendersEveryValueKind checks the rendering of the value
// kinds a frontmatter can hold.
func TestTheFrontmatterRendersEveryValueKind(t *testing.T) {
	source := "---\nname: spec-driven\ndescription: A workflow\nempty:\nitems:\n  - one\n  - two\nnumber: 42\nflag: true\n---\n\n# Body\n"

	parsed := ParseSource(source)
	if _, ok := parsed.Frontmatter["empty"]; ok {
		t.Error("a null frontmatter value was kept")
	}
	if parsed.Frontmatter["items"] != "one, two" {
		t.Errorf("the sequence rendered as %q, want %q", parsed.Frontmatter["items"], "one, two")
	}
	if parsed.Frontmatter["number"] != "42" {
		t.Errorf("the number rendered as %q, want %q", parsed.Frontmatter["number"], "42")
	}
	if parsed.Frontmatter["flag"] != "true" {
		t.Errorf("the boolean rendered as %q, want %q", parsed.Frontmatter["flag"], "true")
	}
}

// TestTheReservedWordsAreQuoted checks that a plain scalar a YAML reader
// would resolve to a boolean or a null is quoted.
//
// The comparison ignores the case, because a YAML reader resolves the
// capitalised forms the same way.
func TestTheReservedWordsAreQuoted(t *testing.T) {
	for _, value := range []string{"true", "False", "null", "Yes", "NO", "on", "Off", "~", "42", "-3.5"} {
		escaped := EscapeYAMLString(value)
		if escaped == value {
			t.Errorf("the reserved word %q was not quoted", value)
		}
		if !strings.HasPrefix(escaped, `"`) {
			t.Errorf("the reserved word %q was rendered as %q, want a quoted string", value, escaped)
		}
	}
	for _, value := range []string{"spec-driven", "A workflow", "skills/spec-driven", "agent-work-auditor"} {
		if escaped := EscapeYAMLString(value); escaped != value {
			t.Errorf("the plain value %q was rendered as %q, want it unchanged", value, escaped)
		}
	}
}

// TestTheQuotedFormIsJSONCompatible checks that the quoted form is the one
// a JSON serializer produces.
func TestTheQuotedFormIsJSONCompatible(t *testing.T) {
	cases := map[string]string{
		`say "hello"`: `"say \"hello\""`,
		"a\tb":        `"a\tb"`,
		"a\\b":        `"a\\b"`,
		"line\nbreak": `"line\nbreak"`,
		"trailing   ": `"trailing   "`,
	}
	for value, expected := range cases {
		if escaped := EscapeYAMLString(value); escaped != expected {
			t.Errorf("the value %q rendered as %q, want %q", value, escaped, expected)
		}
	}
}

// TestTheDerivedArtifactCarriesTheSourceBody checks that a derived artifact
// keeps the body of its source.
func TestTheDerivedArtifactCarriesTheSourceBody(t *testing.T) {
	source := ParseSource("---\nname: spec-driven\ndescription: A workflow\n---\n\n# Body\n\nThe body.\n")

	result, err := Apply(Rule{Serialization: ProfileMarkdown, Name: "spec-driven"}, source)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if !strings.Contains(result.Content, "The body.") {
		t.Errorf("the derived artifact does not carry the body:\n%s", result.Content)
	}
	if !result.BodyPreserved {
		t.Error("the result does not report the body as preserved")
	}
}

// TestAnUnknownWrapperIsRejected checks that a declared body wrapper the
// profile does not apply is refused instead of ignored.
func TestAnUnknownWrapperIsRejected(t *testing.T) {
	source := ParseSource("---\nname: spec-driven\ndescription: A workflow\n---\n\n# Body\n")

	if _, err := Apply(Rule{Serialization: ProfileCommandSkill, Name: "spec-driven", BodyWrapper: "unknown-wrapper"}, source); err == nil {
		t.Error("an unknown body wrapper was accepted")
	}
	if _, err := Apply(Rule{Serialization: ProfileCommandSkill, Name: "spec-driven", BodyWrapper: WrapperSkillPreamble}, source); err != nil {
		t.Errorf("the declared wrapper was refused: %v", err)
	}
}

// TestARepeatedKeyDropsTheFrontmatter checks that a frontmatter with a
// repeated key is ignored, the way the previous implementation ignored it.
//
// The parser of the previous implementation refused a mapping with a
// repeated key, so it transformed the body without any frontmatter. A key
// that appears twice is not a mapping, and an artifact that carries it twice
// is not a valid document.
func TestARepeatedKeyDropsTheFrontmatter(t *testing.T) {
	source := ParseSource("---\nname: n\ndescription: d\ntags: y\ntags: y\n---\n\nBODY")

	if len(source.Frontmatter) != 0 {
		t.Errorf("the frontmatter was kept: %v", source.Frontmatter)
	}
	if len(source.FrontmatterOrder) != 0 {
		t.Errorf("the order of the frontmatter was kept: %v", source.FrontmatterOrder)
	}
	if source.Body != "BODY" {
		t.Errorf("the body is %q, want %q", source.Body, "BODY")
	}
}
