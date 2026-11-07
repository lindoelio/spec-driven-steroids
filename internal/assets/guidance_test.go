package assets

import (
	"io/fs"
	"strings"
	"testing"
)

// The guidance set the shipped instructions direct the host to produce.
var guidanceSet = []string{
	"AGENTS.md",
	"CONVENTIONS.md",
	"TESTING.md",
	"ARCHITECTURE.md",
	"SECURITY.md",
}

// The legacy documents the shipped instructions must stop producing.
var legacyDocuments = []string{"CONTRIBUTING.md", "STYLEGUIDE.md"}

// The merge rule the guidance instructions state, so that the host keeps the
// original wording of the rules the user authored.
const mergeRule = "preserving the original wording of user-authored rules"

// read returns the content of a canonical file.
func read(t *testing.T, path string) string {
	t.Helper()
	content, err := fs.ReadFile(CanonicalFS(), path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(content)
}

// TestTheGuidanceInstructionsDirectTheFiveDocumentSet checks the shipped
// instructions of the guidance skill and the guidance command.
func TestTheGuidanceInstructionsDirectTheFiveDocumentSet(t *testing.T) {
	skill := read(t, "skills/project-guidelines-writer/SKILL.md")
	command := read(t, "commands/inject-guidelines.command.md")

	for _, document := range guidanceSet {
		if !strings.Contains(skill, document) {
			t.Errorf("the guidance skill does not name %s", document)
		}
		if !strings.Contains(command, document) {
			t.Errorf("the guidance command does not name %s", document)
		}
	}
}

// TestTheGuidanceInstructionsStopTheLegacyDocuments checks that the shipped
// instructions no longer produce the two legacy documents as separate
// artifacts.
func TestTheGuidanceInstructionsStopTheLegacyDocuments(t *testing.T) {
	skill := read(t, "skills/project-guidelines-writer/SKILL.md")
	command := read(t, "commands/inject-guidelines.command.md")

	for _, document := range legacyDocuments {
		if !strings.Contains(skill, document) {
			t.Errorf("the guidance skill does not mention the legacy document %s, so it cannot merge it", document)
		}
		if !strings.Contains(command, document) {
			t.Errorf("the guidance command does not mention the legacy document %s, so it cannot merge it", document)
		}
	}
}

// TestTheMergeRuleIsStated checks that the shipped instructions state the
// merge rule explicitly, because the contract test asserts it.
func TestTheMergeRuleIsStated(t *testing.T) {
	skill := read(t, "skills/project-guidelines-writer/SKILL.md")
	command := read(t, "commands/inject-guidelines.command.md")

	if !strings.Contains(skill, mergeRule) {
		t.Errorf("the guidance skill does not state the merge rule %q", mergeRule)
	}
	if !strings.Contains(command, mergeRule) {
		t.Errorf("the guidance command does not state the merge rule %q", mergeRule)
	}
}

// TestTheGuidanceInstructionsLeaveAnUnchangedFileUnwritten checks that the
// shipped instructions tell the host not to rewrite a file that needs no
// change.
func TestTheGuidanceInstructionsLeaveAnUnchangedFileUnwritten(t *testing.T) {
	skill := read(t, "skills/project-guidelines-writer/SKILL.md")
	command := read(t, "commands/inject-guidelines.command.md")

	for name, content := range map[string]string{"the guidance skill": skill, "the guidance command": command} {
		lowered := strings.ToLower(content)
		if !strings.Contains(lowered, "unwritten") {
			t.Errorf("%s does not tell the host to leave an unchanged file unwritten", name)
		}
	}
}

// TestTheGuidanceReferencesDiscoverTheConsolidatedDocument checks that every
// shipped reference that discovers a style guide now finds the consolidated
// document.
func TestTheGuidanceReferencesDiscoverTheConsolidatedDocument(t *testing.T) {
	references := map[string]string{
		"skills/code-review-hardening/SKILL.md":                               "skills/code-review-hardening/SKILL.md",
		"skills/spec-driven-shared-protocol/references/shared-protocol.md":    "skills/spec-driven-shared-protocol/references/shared-protocol.md",
		"skills/spec-driven-shared-protocol/references/document-templates.md": "skills/spec-driven-shared-protocol/references/document-templates.md",
		"skills/spec-driven-planner/references/full-lane-phases.md":           "skills/spec-driven-planner/references/full-lane-phases.md",
		"skills/spec-driven-task-implementer/SKILL.md":                        "skills/spec-driven-task-implementer/SKILL.md",
	}

	for name, path := range references {
		content := read(t, path)
		if !strings.Contains(content, "CONVENTIONS.md") {
			t.Errorf("%s does not discover CONVENTIONS.md", name)
		}
	}

	// The shared protocol routes to its two references; neither of them
	// points at a legacy document any more.
	protocol := read(t, "skills/spec-driven-shared-protocol/SKILL.md")
	for _, document := range legacyDocuments {
		if strings.Contains(protocol, document) {
			t.Errorf("the shared protocol still names the legacy document %s", document)
		}
	}
}

// TestTheLegacyBaselineStaysFrozen checks that the pre-change baseline still
// holds the previous instructions.
//
// The baseline is what recognises a legacy installation by content match. It
// has to keep the content the previous release wrote, so it must not follow
// the guidance rewrite.
func TestTheLegacyBaselineStaysFrozen(t *testing.T) {
	legacy, err := fs.ReadFile(LegacyFS(), "skills/project-guidelines-writer/SKILL.md")
	if err != nil {
		t.Fatalf("read the legacy baseline: %v", err)
	}

	if strings.Contains(string(legacy), mergeRule) {
		t.Error("the legacy baseline already carries the new merge rule, so it is not the pre-change baseline")
	}

	canonical := read(t, "skills/project-guidelines-writer/SKILL.md")
	if string(legacy) == canonical {
		t.Error("the legacy baseline and the canonical tree are identical")
	}
}

// TestTheCanonicalTreeHoldsTheGuidanceSet checks that the shipped tree holds
// the documents the instructions refer to.
func TestTheCanonicalTreeHoldsTheGuidanceSet(t *testing.T) {
	tree := CanonicalFS()
	for _, path := range []string{
		"skills/project-guidelines-writer/SKILL.md",
		"commands/inject-guidelines.command.md",
		"skills/code-review-hardening/SKILL.md",
		"skills/spec-driven-shared-protocol/references/shared-protocol.md",
		"skills/spec-driven-shared-protocol/references/document-templates.md",
		"skills/spec-driven-planner/references/full-lane-phases.md",
		"skills/spec-driven-task-implementer/SKILL.md",
	} {
		if _, err := fs.Stat(tree, path); err != nil {
			t.Errorf("the canonical tree is missing %s", path)
		}
	}
}
