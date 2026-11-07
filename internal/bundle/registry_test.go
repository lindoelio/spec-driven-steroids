package bundle

import (
	"strings"
	"testing"
)

func TestRequiredSkills(t *testing.T) {
	skills := RequiredSkills()

	if len(skills) != 14 {
		t.Fatalf("skills = %d, want 14", len(skills))
	}
	if skills[0] != "spec-driven-planner" {
		t.Fatalf("first skill = %q, want spec-driven-planner", skills[0])
	}
	if skills[len(skills)-1] != "universal-live-check" {
		t.Fatalf("last skill = %q, want universal-live-check", skills[len(skills)-1])
	}

	skills[0] = "mutated"
	if RequiredSkills()[0] != "spec-driven-planner" {
		t.Fatal("the returned list is shared, want a copy")
	}
}

func TestRequiredSkillFiles(t *testing.T) {
	files := RequiredSkillFiles([]string{"spec-driven-planner", "quality-grading"})

	expected := []string{
		"universal/skills/spec-driven-planner/SKILL.md",
		"universal/skills/quality-grading/SKILL.md",
		"universal/skills/spec-driven-planner/references/lane-selection.md",
		"universal/skills/spec-driven-planner/references/full-lane-phases.md",
	}
	if len(files) != len(expected) {
		t.Fatalf("files = %v, want %v", files, expected)
	}
	for index, file := range expected {
		if files[index] != file {
			t.Fatalf("file %d = %q, want %q", index, files[index], file)
		}
	}
}

func TestRequiredSkillFilesWithoutThePlanner(t *testing.T) {
	files := RequiredSkillFiles([]string{"quality-grading"})

	if len(files) != 1 {
		t.Fatalf("files = %v, want one entry point", files)
	}
	if strings.Contains(strings.Join(files, " "), "references") {
		t.Fatalf("files = %v, want no planner references", files)
	}
}

func TestRequiredSkillFilesWithoutSkills(t *testing.T) {
	if files := RequiredSkillFiles(nil); len(files) != 0 {
		t.Fatalf("files = %v, want none", files)
	}
}
