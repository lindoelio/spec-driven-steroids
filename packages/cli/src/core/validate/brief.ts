import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import {
  ValidationError,
  ValidationResult,
  createValidationResult,
  formatError,
  formatValidationResult,
  getExitCode
} from './shared/formatter.js';

const SKILL_DOC = 'skills/spec-driven-brief-planner/SKILL.md';
const REQUIRED_SECTIONS = [
  'Intent',
  'Non-Goals',
  'Acceptance Criteria',
  'Repository Evidence',
  'Implementation Plan',
  'Final Verification'
] as const;

interface BriefTask {
  id: number;
  title: string;
  line: number;
  requirementRefs: string[];
}

interface BriefValidationResult extends ValidationResult {
  requirementsFound: string[];
  tasksFound: BriefTask[];
  coveredRequirements: string[];
}

interface Section {
  content: string;
  headingLine: number;
  index: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(content: string, name: string): Section | undefined {
  const lines = content.split('\n');
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(name)}\\s*$`, 'i');
  const headingIndex = lines.findIndex(line => headingPattern.test(line));
  if (headingIndex === -1) return undefined;

  let endIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index++) {
    if (/^##\s+/.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  return {
    content: lines.slice(headingIndex + 1, endIndex).join('\n'),
    headingLine: headingIndex + 1,
    index: headingIndex
  };
}

const TEMPLATE_TOKEN_PATTERN = /<\s*(?:problem, expected outcome, and scope boundary|explicitly excluded behavior|observable outcome|evidence and role in the change|planned role|concrete action|exact scoped change|focused command or observable check|optional low or medium risk|final command or observable check|path|slug|describe[^>]*|fill(?: in)?[^>]*)\s*>/i;

function hasProsePlaceholder(value: string): boolean {
  return /\b(?:TODO|TBD|TBA|FIXME)\b/i.test(value) || TEMPLATE_TOKEN_PATTERN.test(value);
}

function normalizeEvidencePath(value: string): string {
  return path.posix.normalize(value.replace(/\\/g, '/'));
}

function addError(
  errors: ValidationError[],
  errorType: string,
  context: string,
  suggestedFix: string,
  line?: number
): void {
  errors.push({ errorType, context, suggestedFix, line, skillDocLink: SKILL_DOC });
}

export function verifyBriefFile(content: string): BriefValidationResult {
  const errors: ValidationError[] = [];
  const warnings: Array<{ line?: number; message: string }> = [];
  const requirementsFound: string[] = [];
  const tasksFound: BriefTask[] = [];
  const coveredRequirements = new Set<string>();
  const evidencePaths = new Set<string>();

  const firstNonEmptyLine = content.split('\n').find(line => line.trim().length > 0);
  if (firstNonEmptyLine?.trim() !== '# Change Brief') {
    addError(errors, 'Structure Error', 'Document must start with # Change Brief', 'Add # Change Brief as the first non-empty line');
  }

  if (!/^\*\*Lane:\*\*\s+brief\s*$/mi.test(content)) {
    addError(errors, 'Structure Error', 'Brief lane declaration is missing or invalid', 'Add **Lane:** brief below the document title');
  }

  const sections = new Map<string, Section>();
  for (const sectionName of REQUIRED_SECTIONS) {
    const section = extractSection(content, sectionName);
    if (!section) {
      addError(errors, 'Structure Error', `${sectionName} section not found`, `Add ## ${sectionName}`);
      continue;
    }
    sections.set(sectionName, section);
  }

  const allowedSections = new Set<string>([...REQUIRED_SECTIONS, 'Risks']);
  for (const [index, line] of content.split('\n').entries()) {
    const heading = line.match(/^##\s+(.+?)\s*$/)?.[1];
    if (heading && !allowedSections.has(heading)) {
      addError(errors, 'Structure Error', `Unsupported section: ${heading}`, 'Use only the required brief sections and optional ## Risks', index + 1);
    }
  }

  let previousSectionIndex = -1;
  for (const sectionName of REQUIRED_SECTIONS) {
    const section = sections.get(sectionName);
    if (!section) continue;
    if (section.index < previousSectionIndex) {
      addError(errors, 'Structure Error', `${sectionName} section is out of order`, `Place ## ${sectionName} after the preceding required section`, section.headingLine);
    }
    previousSectionIndex = Math.max(previousSectionIndex, section.index);
  }

  const risksSection = extractSection(content, 'Risks');
  const implementationSection = sections.get('Implementation Plan');
  const finalVerificationSection = sections.get('Final Verification');
  if (risksSection && implementationSection && finalVerificationSection &&
    (risksSection.index < implementationSection.index || risksSection.index > finalVerificationSection.index)) {
    addError(errors, 'Structure Error', 'Risks section is out of order', 'Place optional ## Risks between ## Implementation Plan and ## Final Verification', risksSection.headingLine);
  }

  const intentSection = sections.get('Intent');
  if (intentSection) {
    const intent = intentSection.content.trim();
    if (!intent || hasProsePlaceholder(intent)) {
      addError(errors, 'Placeholder Error', 'Intent must contain resolved change intent', 'Replace placeholders with the concrete problem, outcome, and scope', intentSection.headingLine + 1);
    }
  }

  const nonGoalsSection = sections.get('Non-Goals');
  if (nonGoalsSection) {
    const nonGoals = nonGoalsSection.content.split('\n').filter(line => /^-\s+\S/.test(line));
    if (nonGoals.length === 0 || nonGoals.some(hasProsePlaceholder)) {
      addError(errors, 'Format Error', 'Non-Goals must contain at least one resolved bullet', 'Add one or more concrete out-of-scope bullets', nonGoalsSection.headingLine + 1);
    }
  }

  const acceptanceSection = sections.get('Acceptance Criteria');
  if (acceptanceSection) {
    const lines = acceptanceSection.content.split('\n');
    for (let index = 0; index < lines.length; index++) {
      if (/^-\s+\S/.test(lines[index]) && !/^-\s+REQ-\d+:\s+.+$/.test(lines[index])) {
        addError(errors, 'Format Error', `Invalid acceptance criterion: ${lines[index]}`, 'Use - REQ-N: <observable outcome>', acceptanceSection.headingLine + index + 1);
        continue;
      }
      const match = lines[index].match(/^-\s+(REQ-(\d+)):\s+(.+)$/);
      if (!match) continue;
      requirementsFound.push(match[1]);
      if (hasProsePlaceholder(match[3])) {
        addError(errors, 'Placeholder Error', `${match[1]} contains unresolved placeholder text`, 'Replace the placeholder with an observable outcome', acceptanceSection.headingLine + index + 1);
      }
    }

    if (requirementsFound.length < 1 || requirementsFound.length > 5) {
      addError(errors, 'Format Error', `Brief must contain 1-5 requirements; found ${requirementsFound.length}`, 'Add between 1 and 5 acceptance criteria using - REQ-N: <observable outcome>', acceptanceSection.headingLine + 1);
    }

    for (let index = 0; index < requirementsFound.length; index++) {
      const expected = `REQ-${index + 1}`;
      if (requirementsFound[index] !== expected) {
        addError(errors, 'Format Error', `Requirement numbering is not contiguous at ${requirementsFound[index]}`, `Renumber requirements sequentially starting at ${expected}`, acceptanceSection.headingLine + 1);
        break;
      }
    }
  }

  const evidenceSection = sections.get('Repository Evidence');
  if (evidenceSection) {
    const evidenceLines = evidenceSection.content.split('\n').filter(line => /^-\s+\S/.test(line));
    const evidencePattern = /^-\s+(Existing|New):\s+`([^`]+)`\s+-\s+(.+)$/;
    if (evidenceLines.length === 0) {
      addError(errors, 'Format Error', 'Repository Evidence has no entries', 'Add at least one Existing or New path entry', evidenceSection.headingLine + 1);
    }
    for (let index = 0; index < evidenceLines.length; index++) {
      const match = evidenceLines[index].match(evidencePattern);
      if (!match || hasProsePlaceholder(match[2]) || hasProsePlaceholder(match[3])) {
        addError(errors, 'Format Error', `Invalid Repository Evidence entry: ${evidenceLines[index]}`, 'Use - Existing: `path` - evidence or - New: `path` - purpose', evidenceSection.headingLine + index + 1);
      } else {
        evidencePaths.add(normalizeEvidencePath(match[2]));
      }
    }
  }

  if (implementationSection) {
    const lines = implementationSection.content.split('\n');
    const taskStarts: Array<{ lineIndex: number; marker: string; id: number; title: string }> = [];

    for (let index = 0; index < lines.length; index++) {
      const match = lines[index].match(/^-\s+\[([^\]])\]\s+(\d+)\.\s+(.+)$/);
      if (/^-\s+\[/.test(lines[index]) && !match) {
        addError(errors, 'Format Error', `Invalid implementation task: ${lines[index]}`, 'Use - [ ] N. <action title>', implementationSection.headingLine + index + 1);
      }
      if (!match) continue;
      taskStarts.push({ lineIndex: index, marker: match[1], id: Number(match[2]), title: match[3].trim() });
    }

    if (taskStarts.length < 1 || taskStarts.length > 8) {
      addError(errors, 'Format Error', `Brief must contain 1-8 tasks; found ${taskStarts.length}`, 'Add between 1 and 8 checkbox tasks', implementationSection.headingLine + 1);
    }

    for (let index = 0; index < taskStarts.length; index++) {
      const taskStart = taskStarts[index];
      const taskLine = implementationSection.headingLine + taskStart.lineIndex + 1;
      const nextStart = taskStarts[index + 1]?.lineIndex ?? lines.length;
      const taskBlock = lines.slice(taskStart.lineIndex, nextStart).join('\n');

      if (![' ', '~', 'x'].includes(taskStart.marker)) {
        addError(errors, 'Format Error', `Invalid status marker for task ${taskStart.id}: '${taskStart.marker}'`, 'Use [ ], [~], or [x]', taskLine);
      }
      if (taskStart.id !== index + 1) {
        addError(errors, 'Format Error', `Task numbering is not contiguous at ${taskStart.id}`, `Renumber this task to ${index + 1}`, taskLine);
      }
      if (hasProsePlaceholder(taskStart.title)) {
        addError(errors, 'Placeholder Error', `Task ${taskStart.id} title contains unresolved placeholder text`, 'Replace the placeholder with a concrete action', taskLine);
      }

      const change = taskBlock.match(/^[ \t]+-\s+Change:\s+(.+)$/mi)?.[1];
      const files = taskBlock.match(/^[ \t]+-\s+Files:\s+(.+)$/mi)?.[1];
      const verify = taskBlock.match(/^[ \t]+-\s+Verify:\s+(.+)$/mi)?.[1];
      const implementsMatch = taskBlock.match(/_Implements:\s*([^_\n]+)_/i);

      if (!change || hasProsePlaceholder(change)) {
        addError(errors, 'Format Error', `Task ${taskStart.id} is missing a resolved Change field`, 'Add - Change: <exact scoped change>', taskLine);
      }
      if (!files || !/`[^`]+`/.test(files) || hasProsePlaceholder(files)) {
        addError(errors, 'Format Error', `Task ${taskStart.id} is missing valid Files`, 'Add - Files: with one or more backticked paths', taskLine);
      } else {
        const taskPaths = new Set(Array.from(files.matchAll(/`([^`]+)`/g), match => normalizeEvidencePath(match[1])));
        for (const filePath of taskPaths) {
          if (!evidencePaths.has(filePath)) {
            warnings.push({
              line: taskLine,
              message: `Repository Evidence: task ${taskStart.id} references ${filePath} without an Existing or New entry`
            });
          }
        }
      }
      if (!verify || hasProsePlaceholder(verify)) {
        addError(errors, 'Format Error', `Task ${taskStart.id} is missing a resolved Verify field`, 'Add - Verify: with a command or observable check', taskLine);
      } else if (!/`[^`]*[^\s`][^`]*`/.test(verify) && !/^Check:\s*\S.*?\s*(?:=>|→)\s*\S.*$/i.test(verify)) {
        warnings.push({
          line: taskLine,
          message: `Verification signal: task ${taskStart.id} should use a backticked command or Check: <action> => <observable outcome>; this heuristic does not establish correctness`
        });
      }
      if (!implementsMatch) {
        addError(errors, 'Traceability Error', `Task ${taskStart.id} is missing _Implements`, 'Add _Implements: REQ-N_', taskLine);
      }

      const refs = implementsMatch?.[1].match(/REQ-\d+/g) ?? [];
      if (implementsMatch && refs.length === 0) {
        addError(errors, 'Traceability Error', `Task ${taskStart.id} does not reference a brief requirement`, 'Add at least one REQ-N reference', taskLine);
      }
      if (implementsMatch && /DES-\d+/i.test(implementsMatch[1])) {
        addError(errors, 'Traceability Error', `Task ${taskStart.id} references DES IDs in the brief lane`, 'Remove DES references; brief tasks trace directly to REQ-N', taskLine);
      }
      if (implementsMatch && /REQ-\d+\.\d+/i.test(implementsMatch[1])) {
        addError(errors, 'Traceability Error', `Task ${taskStart.id} uses full-lane acceptance-criterion IDs`, 'Use brief-level REQ-N references without decimal suffixes', taskLine);
      }
      for (const ref of refs) {
        if (!requirementsFound.includes(ref)) {
          addError(errors, 'Traceability Error', `${ref} is referenced by task ${taskStart.id} but not declared`, `Declare ${ref} or correct the task reference`, taskLine);
        } else {
          coveredRequirements.add(ref);
        }
      }

      tasksFound.push({ id: taskStart.id, title: taskStart.title, line: taskLine, requirementRefs: refs });
    }
  }

  for (const requirement of requirementsFound) {
    if (!coveredRequirements.has(requirement)) {
      addError(errors, 'Traceability Error', `${requirement} is not covered by an implementation task`, `Add ${requirement} to a task _Implements tag`);
    }
  }

  if (risksSection && (!risksSection.content.trim() || hasProsePlaceholder(risksSection.content))) {
    addError(errors, 'Placeholder Error', 'Risks is empty or contains unresolved placeholder text', 'Resolve or remove the optional Risks section', risksSection.headingLine + 1);
  }

  if (finalVerificationSection) {
    const checks = finalVerificationSection.content.split('\n').filter(line => /^-\s+\S/.test(line));
    if (checks.length === 0 || checks.some(hasProsePlaceholder)) {
      addError(errors, 'Format Error', 'Final Verification must contain at least one resolved check', 'Add one or more verification command or observable-check bullets', finalVerificationSection.headingLine + 1);
    }
  }

  return {
    ...createValidationResult(errors.length === 0, errors, warnings),
    requirementsFound,
    tasksFound,
    coveredRequirements: [...coveredRequirements]
  };
}

export function createBriefCommand(): Command {
  const cmd = new Command();

  cmd
    .name('brief')
    .description('Validate a brief.md file for structure, bounded scope, and requirement-to-task traceability')
    .argument('<path>', 'Path to brief.md file')
    .option('--format <text|json>', 'Output format (text or json)', 'text')
    .action(async (filePath: string, opts: { format: string }) => {
      const fullPath = path.resolve(process.cwd(), filePath);
      let content: string;

      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        console.error(chalk.red(`Error: Cannot read file: ${fullPath}`));
        process.exitCode = 1;
        return;
      }

      const result = verifyBriefFile(content);
      if (opts.format === 'json') {
        console.log(formatValidationResult(result, 'json'));
      } else if (!result.valid) {
        console.log(chalk.red('❌ Brief validation failed:\n'));
        for (const error of result.errors) {
          console.log(formatError(error));
          console.log();
        }
      } else {
        console.log(chalk.green('✅ Brief validation passed.'));
        console.log(`\nFound ${result.requirementsFound.length} requirements and ${result.tasksFound.length} tasks.`);
      }

      if (opts.format !== 'json') {
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`Warning${warning.line ? ` (line ${warning.line})` : ''}: ${warning.message}`));
        }
      }

      process.exitCode = getExitCode(result);

      return;
    });

  return cmd;
}
