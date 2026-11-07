package bundle

// The skill registry names the skills the canonical tree carries and the
// files a bundle must provide for them.

// steroidSkillDirs are the fourteen skill directories the canonical tree
// carries and a template bundle must provide.
var steroidSkillDirs = []string{
	"spec-driven-planner",
	"spec-driven-technical-designer",
	"spec-driven-task-implementer",
	"spec-driven-requirements-writer",
	"spec-driven-task-decomposer",
	"spec-driven-brief-planner",
	"spec-driven-shared-protocol",
	"long-running-work-planning",
	"project-guidelines-writer",
	"agent-work-auditor",
	"code-review-hardening",
	"contextual-stewardship",
	"quality-grading",
	"universal-live-check",
}

// plannerSkill is the skill that carries normative references beside its
// entry point.
const plannerSkill = "spec-driven-planner"

// RequiredSkills returns the fourteen required skill directory names.
func RequiredSkills() []string {
	skills := make([]string, len(steroidSkillDirs))
	copy(skills, steroidSkillDirs)
	return skills
}

// RequiredSkillFiles returns the required skill file paths for the given
// skills.
//
// Every skill contributes its entry point. The planner contributes its two
// normative references as well, because the workflow depends on them.
func RequiredSkillFiles(skills []string) []string {
	files := make([]string, 0, len(skills)+2)
	for _, skill := range skills {
		files = append(files, "universal/skills/"+skill+"/SKILL.md")
	}
	for _, skill := range skills {
		if skill == plannerSkill {
			files = append(files,
				"universal/skills/"+plannerSkill+"/references/lane-selection.md",
				"universal/skills/"+plannerSkill+"/references/full-lane-phases.md",
			)
			break
		}
	}
	return files
}
