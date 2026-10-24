export const STEROIDS_SKILL_DIRS = [
  'spec-driven-planner',
  'spec-driven-technical-designer',
  'spec-driven-task-implementer',
  'spec-driven-requirements-writer',
  'spec-driven-task-decomposer',
  'spec-driven-brief-planner',
  'spec-driven-shared-protocol',
  'long-running-work-planning',
  'project-guidelines-writer',
  'agent-work-auditor',
  'code-review-hardening',
  'contextual-stewardship',
  'quality-grading',
  'universal-live-check'
] as const;

export function getRequiredSkillFiles(skills: readonly string[]): string[] {
  const files = skills.map(skill => `universal/skills/${skill}/SKILL.md`);
  if (skills.includes('spec-driven-planner')) {
    files.push(
      'universal/skills/spec-driven-planner/references/lane-selection.md',
      'universal/skills/spec-driven-planner/references/full-lane-phases.md'
    );
  }
  return files;
}
