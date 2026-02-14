#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

const SKILL_DOCS = {
  requirements: "packages/standards/src/templates/universal/skills/spec-driven-requirements-writer/SKILL.md",
  design: "packages/standards/src/templates/universal/skills/spec-driven-technical-designer/SKILL.md",
  tasks: "packages/standards/src/templates/universal/skills/spec-driven-task-decomposer/SKILL.md",
  implementation: "packages/standards/src/templates/universal/skills/spec-driven-task-implementer/SKILL.md"
} as const;

interface FormattedError {
  errorType: string;
  context: string;
  suggestedFix: string;
  skillDocLink?: string;
}

export function formatError(error: FormattedError): string {
  const { errorType, context, suggestedFix, skillDocLink } = error;
  let message = `[${errorType}] → ${context} → ${suggestedFix}`;

  if (skillDocLink) {
    message += `\n   See: ${skillDocLink}`;
  }

  return message;
}

export function findLineNumber(content: string, pattern: RegExp): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return -1;
}

export function addLineInfo(error: string, line: number): string {
  if (line > 0) {
    return `${error}\n   Line: ${line}`;
  }
  return error;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function stripInlineMarkdown(value: string): string {
  return value.replace(/[*_`]/g, '');
}

function extractDesignElementIds(content: string): string[] {
  const fromHeadings = Array.from(content.matchAll(/^###\s+(DES-\d+)\b/gmi), (match) => match[1]);
  const explicit = content.match(/DES-\d+/g) || [];
  return unique([...fromHeadings, ...explicit]);
}

function extractRequirementIds(content: string): string[] {
  const fromHeadings = Array.from(content.matchAll(/^###\s+Requirement\s+(\d+)\s*:/gmi), (match) => `REQ-${match[1]}`);
  const explicit = content.match(/REQ-\d+/g) || [];
  return unique([...fromHeadings, ...explicit]);
}

function extractAcceptanceCriteriaRefs(content: string): string[] {
  const refs: string[] = [];
  const explicit = content.match(/REQ-\d+\.\d+/g) || [];
  refs.push(...explicit);

  const lines = content.split('\n');
  let currentReq: string | null = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+Requirement\s+(\d+)\s*:/i);
    if (heading) {
      currentReq = heading[1];
      continue;
    }

    if (!currentReq) {
      continue;
    }

    const criteria = line.match(/^\s*(\d+)(?:\.\d+)?(?:\.)?\s+/);
    if (criteria) {
      refs.push(`REQ-${currentReq}.${criteria[1]}`);
    }
  }

  return unique(refs);
}

const server = new Server(
  {
    name: "spec-driven-steroids-mcp",
    version: "0.2.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Tool: verify_spec_structure
 * Validates spec folder structure and file existence
 */
async function verifySpecStructure(
  slug: string,
  targetDir: string = process.cwd()
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const specDir = path.join(targetDir, "specs", "changes", slug);

  // Check if directory exists
  let files: string[] = [];
  try {
    const stats = await fs.stat(specDir);
    if (!stats.isDirectory()) {
      const fileContent = await fs.readFile(specDir, "utf-8").catch(() => "");
      if (fileContent.trim().length === 0) {
        files = [];
      } else {
        errors.push(formatError({
          errorType: "Structure Error",
          context: `Path is not a directory: ${specDir}`,
          suggestedFix: "Create spec directory with: mkdir -p specs/changes/{slug}"
        }));
        return { valid: false, errors, warnings };
      }
    } else {
      files = await fs.readdir(specDir);
    }
  } catch {
    errors.push(formatError({
      errorType: "Structure Error",
      context: `Spec directory does not exist: ${specDir}`,
      suggestedFix: "Create spec directory with: mkdir -p specs/changes/{slug}"
    }));
    return { valid: false, errors, warnings };
  }

  // Check for required files
  const requiredFiles = ["requirements.md", "design.md", "tasks.md"];

  for (const requiredFile of requiredFiles) {
    if (!files.includes(requiredFile)) {
      const skillMap: Record<string, string> = {
        "requirements.md": SKILL_DOCS.requirements,
        "design.md": SKILL_DOCS.design,
        "tasks.md": SKILL_DOCS.tasks
      };
      errors.push(formatError({
        errorType: "Structure Error",
        context: `Missing required file: ${requiredFile}`,
        suggestedFix: `Create ${requiredFile} with proper structure`,
        skillDocLink: skillMap[requiredFile]
      }));
    }
  }

  // Check for unexpected files
  const allowedFiles = [...requiredFiles];
  const unexpectedFiles = files.filter(f => !allowedFiles.includes(f));
  if (unexpectedFiles.length > 0) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: `Unexpected files found: ${unexpectedFiles.join(", ")}`,
      suggestedFix: "Only requirements.md, design.md, and tasks.md are allowed. Remove or rename extra files"
    }));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Tool: verify_requirements_file
 * Validates a requirements.md file has all required content
 */
function verifyRequirementsFile(content: string): {
  valid: boolean;
  errors: string[];
  requirementsFound: string[];
  earsPatterns: string[];
} {
  const errors: string[] = [];
  const requirementsFound: string[] = [];
  const earsPatterns: string[] = [];

  const enforceDocumentSections = content.includes('# Requirements Document');

  // Check for required sections
  if (enforceDocumentSections && !content.includes('## Introduction')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Introduction section not found",
      suggestedFix: "Add ## Introduction section at top with project background and objectives",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }
  if (enforceDocumentSections && !content.includes('## Glossary')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Glossary section not found",
      suggestedFix: "Add ## Glossary section defining key terms",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }
  if (enforceDocumentSections && !content.includes('## Requirements')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Requirements section not found",
      suggestedFix: "Add ## Requirements section with REQ-X numbering",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }

  // Extract requirement IDs
  const reqMatches = extractRequirementIds(content);
  if (reqMatches.length > 0) {
    requirementsFound.push(...reqMatches);
  } else {
    errors.push(formatError({
      errorType: "Format Error",
      context: "No REQ-X IDs found",
      suggestedFix: "Number each requirement with REQ-1, REQ-2, etc.",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }

  // Extract EARS patterns
  const earsKeywords = ["WHEN", "IF", "THEN", "SHALL", "WHILE", "WHERE"];
  for (const keyword of earsKeywords) {
    if (content.includes(keyword)) {
      earsPatterns.push(keyword);
    }
  }

  if (earsPatterns.length === 0) {
    errors.push(formatError({
      errorType: "Format Error",
      context: "No EARS patterns detected",
      suggestedFix: "Use EARS keywords (WHEN, IF, THEN, SHALL, WHILE, WHERE) to structure requirements",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }

  // Check for acceptance criteria numbering
  const acceptanceCriteriaMatches = content.match(/^\s*\d+(?:\.\d+)?(?:\.)?\s+/gm);
  if (!acceptanceCriteriaMatches || acceptanceCriteriaMatches.length === 0) {
    errors.push(formatError({
      errorType: "Format Error",
      context: "No 1.1, 1.2, etc. numbering found",
      suggestedFix: "Add numbered acceptance criteria for each requirement",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }

  return {
    valid: errors.length === 0,
    errors,
    requirementsFound,
    earsPatterns
  };
}

/**
 * Tool: verify_design_file
 * Validates a design.md file has all required content and proper structure
 */
function verifyDesignFile(content: string, requirementsContent?: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  traceabilityReport: {
    linked: string[];
    orphaned: string[];
    invalidReqRefs: string[];
  };
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const linked: string[] = [];
  const orphaned: string[] = [];
  const invalidReqRefs: string[] = [];

  const enforceDocumentSections = /##\s+(Overview|Code Anatomy|Traceability Matrix)/i.test(content) || content.includes('# Design Document');

  // Check for required sections (only when validating a full design document)
  if (enforceDocumentSections && !content.includes('## Overview')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Overview section not found",
      suggestedFix: "Add ## Overview section describing high-level design approach",
      skillDocLink: SKILL_DOCS.design
    }));
  }
  if (enforceDocumentSections && !content.includes('## System Architecture')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "System Architecture section not found",
      suggestedFix: "Add ## System Architecture section with Mermaid diagrams",
      skillDocLink: SKILL_DOCS.design
    }));
  }
  if (enforceDocumentSections && !content.includes('## Code Anatomy')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Code Anatomy section not found",
      suggestedFix: "Add ## Code Anatomy section with file paths and details",
      skillDocLink: SKILL_DOCS.design
    }));
  }

  // Check for Mermaid diagrams
  if (!content.includes('```mermaid')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "No Mermaid diagram code blocks found",
      suggestedFix: "Add Mermaid diagram in ```mermaid ... ``` code blocks",
      skillDocLink: SKILL_DOCS.design
    }));
  }

  // Extract design element IDs
  const desMatches = Array.from(content.matchAll(/^###\s+(DES-\d+)\b/gm), (match) => match[1]);
  if (!desMatches || desMatches.length === 0) {
    errors.push(formatError({
      errorType: "Format Error",
      context: "No DES-X design element IDs found",
      suggestedFix: "Number design elements with DES-1, DES-2, etc.",
      skillDocLink: SKILL_DOCS.design
    }));
  } else {
    const uniqueDes = unique(desMatches);
    const reqIds: string[] = requirementsContent ? extractAcceptanceCriteriaRefs(requirementsContent) : [];
    const lines = content.split('\n');
    const hasAnyTraceabilityTags = /_Implements:/i.test(content);

    if (!hasAnyTraceabilityTags) {
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        traceabilityReport: {
          linked,
          orphaned,
          invalidReqRefs
        }
      };
    }

    for (let i = 0; i < uniqueDes.length; i++) {
      const desId = uniqueDes[i];
      const start = lines.findIndex((line) => new RegExp(`^###\\s+${desId}\\b`).test(line));
      const end = i < uniqueDes.length - 1
        ? lines.findIndex((line, index) => index > start && new RegExp(`^###\\s+${uniqueDes[i + 1]}\\b`).test(line))
        : lines.length;

      const section = lines.slice(start, end > -1 ? end : lines.length).join('\n');
      const implementsLine = section.match(/_Implements:[^\n]+/i)?.[0] || '';
      const reqRefs = implementsLine.match(/REQ-\d+(?:\.\d+)?/g) || [];

      if (reqRefs.length === 0) {
        const line = findLineNumber(content, new RegExp(`^###\\s+${desId}\\b`, 'm'));
        const orphan = addLineInfo(desId, line);
        orphaned.push(orphan);
        errors.push(formatError({
          errorType: "Traceability Error",
          context: `${desId} has no requirement traceability link`,
          suggestedFix: `Add _Implements: REQ-X.Y_ under ${desId}`,
          skillDocLink: SKILL_DOCS.design
        }));
        continue;
      }

      for (const reqRef of reqRefs) {
        linked.push(`${desId} -> ${reqRef}`);
        if (reqIds.length > 0 && !reqIds.includes(reqRef)) {
          const line = findLineNumber(content, new RegExp(reqRef.replace('.', '\\.'), 'm'));
          const invalid = addLineInfo(formatError({
            errorType: "Traceability Error",
            context: `${desId} refers to non-existent requirement ${reqRef}`,
            suggestedFix: `Fix requirement reference or create missing ${reqRef} in requirements.md`,
            skillDocLink: SKILL_DOCS.design
          }), line);
          invalidReqRefs.push(invalid);
          errors.push(invalid);
        }
      }
    }
  }

  // Check for Traceability Matrix
  if (enforceDocumentSections && !content.includes('## Traceability Matrix')) {
    warnings.push(formatError({
      errorType: "Structure Error",
      context: "Traceability Matrix section not found",
      suggestedFix: "Add ## Traceability Matrix section linking DES to REQ",
      skillDocLink: SKILL_DOCS.design
    }));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    traceabilityReport: {
      linked,
      orphaned,
      invalidReqRefs
    }
  };
}

/**
 * Tool: verify_tasks_file
 * Validates a tasks.md file has all required content and proper structure
 */
function verifyTasksFile(content: string, designContent?: string): {
  valid: boolean;
  errors: string[];
  tasksFound: number;
  phases: string[];
  traceabilityReport: {
    linked: string[];
    missingTraces: string[];
  };
} {
  const errors: string[] = [];
  const linked: string[] = [];
  const missingTraces: string[] = [];
  const phases: string[] = [];

  // Check for Overview section
  if (!content.includes('## Overview')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Overview section not found",
      suggestedFix: "Add ## Overview section with phases list",
      skillDocLink: SKILL_DOCS.tasks
    }));
  }

  // Extract phases
  const phaseMatches = content.match(/^##\s*Phase\s+\d+\s*:[^\n]*/gmi);
  if (!phaseMatches || phaseMatches.length === 0) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "No phase headers found",
      suggestedFix: "Add phase sections using ## Phase 1:, ## Phase 2:, etc.",
      skillDocLink: SKILL_DOCS.tasks
    }));
  } else {
    phases.push(...phaseMatches);
  }

  // Check for Final Checkpoint phase
  const hasFinalCheckpoint = phases.some((phase) => /Final\s+Checkpoint/i.test(stripInlineMarkdown(phase)));
  if (phases.length > 1 && !hasFinalCheckpoint) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Final Checkpoint phase not found",
      suggestedFix: "Add ## Phase X: Final Checkpoint section at end",
      skillDocLink: SKILL_DOCS.tasks
    }));
  }

  // Extract task IDs from checkbox format
  const lines = content.split('\n');
  const taskMatches = content.match(/^- \[[^\]]\]\s+.*$/gm);
  if (!taskMatches || taskMatches.length === 0) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "No tasks in checkbox format found",
      suggestedFix: "Add tasks with format - [ ] 1.1, - [ ] 1.2, etc.",
      skillDocLink: SKILL_DOCS.tasks
    }));
  } else {
    let currentPhaseHeader = "";

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];

      if (/^##\s*Phase\s+\d+\s*:/i.test(line)) {
        currentPhaseHeader = line;
      }

      const taskMatch = line.match(/^- \[([^\]])\]\s+(.*)$/);
      if (!taskMatch) {
        continue;
      }

      const marker = taskMatch[1];
      const taskLabel = taskMatch[2].trim();
      const taskId = taskLabel.match(/\d+\.\d+/)?.[0] || taskLabel;
      const lineNumber = index + 1;

      if (![' ', '~', 'x'].includes(marker)) {
        errors.push(formatError({
          errorType: "Format Error",
          context: "Invalid status marker detected",
          suggestedFix: "Use only: [ ] (pending), [~] (in progress), [x] (completed)",
          skillDocLink: SKILL_DOCS.tasks
        }));
      }

      if (/Final\s+Checkpoint/i.test(stripInlineMarkdown(currentPhaseHeader))) {
        continue;
      }

      const taskBlock: string[] = [line];
      for (let j = index + 1; j < lines.length; j++) {
        if (/^- \[[^\]]\]\s+/.test(lines[j]) || /^##\s*Phase\s+\d+\s*:/i.test(lines[j])) {
          break;
        }
        taskBlock.push(lines[j]);
      }

      const taskText = taskBlock.join('\n');
      const traceMatch = taskText.match(/_Implements:\s*([^_\n]+)_/i);
      if (!traceMatch) {
        missingTraces.push(addLineInfo(taskId, lineNumber));
        continue;
      }

      linked.push(`${taskId} → ${traceMatch[1].trim()}`);
    }
  }

  // Determine if traceability is required based on document structure
  // If any task has a numbered ID (like 1.1, 1.2), traceability is required
  const hasNumberedTaskIds = /- \[[^\]]\]\s+\d+\.\d+\b/.test(content);
  const hasAnyImplementsTags = /_Implements:/i.test(content);
  const traceabilityRequired = (hasNumberedTaskIds && hasFinalCheckpoint) || hasAnyImplementsTags;

  if (traceabilityRequired && missingTraces.length > 0) {
    errors.push(formatError({
      errorType: "Traceability Error",
      context: `Missing traceability links for ${missingTraces.length} task(s)`,
      suggestedFix: "Add _Implements: DES-X_ (and optional REQ-X.Y) to each non-checkpoint task",
      skillDocLink: SKILL_DOCS.tasks
    }));
  }

  if (designContent) {
    const desIds = extractDesignElementIds(designContent);
    const implementedDesIds = unique(Array.from(content.matchAll(/_Implements:\s*([^_\n]+)_/gi), (match) => {
      const desRefs = match[1].match(/DES-\d+/g);
      return desRefs || [];
    }).flat());

    for (const implementedDesId of implementedDesIds) {
      if (!desIds.includes(implementedDesId)) {
        const line = findLineNumber(content, new RegExp(implementedDesId.replace('.', '\\.'), 'm'));
        errors.push(addLineInfo(formatError({
          errorType: "Traceability Error",
          context: `${implementedDesId} is referenced in tasks but not defined in design.md`,
          suggestedFix: `Fix task traceability reference or add ${implementedDesId} to design.md`,
          skillDocLink: SKILL_DOCS.tasks
        }), line));
      }
    }
  }

  // Validation passes if no errors and (either no missing traces or traceability not required)
  const isValid = errors.length === 0 && (!traceabilityRequired || missingTraces.length === 0);

  return {
    valid: isValid,
    errors,
    tasksFound: taskMatches?.length || 0,
    phases,
    traceabilityReport: {
      linked,
      missingTraces
    }
  };
}

/**
 * Tool: verify_complete_spec
 * Validates all three spec files together for complete workflow validation
 */
async function verifyCompleteSpec(
  slug: string,
  targetDir: string = process.cwd()
): Promise<{
  valid: boolean;
  overallErrors: string[];
  requirementsErrors: string[];
  designErrors: string[];
  tasksErrors: string[];
  traceabilityReport: {
    complete: boolean;
    orphans: string[];
    circular: string[];
  };
}> {
  const overallErrors: string[] = [];
  const requirementsErrors: string[] = [];
  const designErrors: string[] = [];
  const tasksErrors: string[] = [];

  const specDir = path.join(targetDir, "specs", "changes", slug);

  // Check folder structure
  const structureResult = await verifySpecStructure(slug, targetDir);
  if (!structureResult.valid) {
    overallErrors.push(...structureResult.errors);
  }

  // Read files
  let requirementsContent = "";
  let designContent = "";
  let tasksContent = "";

  try {
    requirementsContent = await fs.readFile(path.join(specDir, "requirements.md"), "utf-8");
  } catch (e) {
    const error = formatError({
      errorType: "File Error",
      context: "Cannot read requirements.md",
      suggestedFix: "Ensure file exists in specs/changes/{slug}/ directory"
    });
    requirementsErrors.push(error);
    overallErrors.push(error);
  }

  try {
    designContent = await fs.readFile(path.join(specDir, "design.md"), "utf-8");
  } catch (e) {
    const error = formatError({
      errorType: "File Error",
      context: "Cannot read design.md",
      suggestedFix: "Ensure file exists in specs/changes/{slug}/ directory"
    });
    designErrors.push(error);
    overallErrors.push(error);
  }

  try {
    tasksContent = await fs.readFile(path.join(specDir, "tasks.md"), "utf-8");
  } catch (e) {
    const error = formatError({
      errorType: "File Error",
      context: "Cannot read tasks.md",
      suggestedFix: "Ensure file exists in specs/changes/{slug}/ directory"
    });
    tasksErrors.push(error);
    overallErrors.push(error);
  }

  // Validate individual files
  if (requirementsContent) {
    const reqResult = verifyRequirementsFile(requirementsContent);
    if (!reqResult.valid) {
      requirementsErrors.push(...reqResult.errors);
    }
  }

  if (designContent) {
    const desResult = verifyDesignFile(designContent, requirementsContent);
    if (!desResult.valid) {
      designErrors.push(...desResult.errors);
    }
  }

  if (tasksContent) {
    const taskResult = verifyTasksFile(tasksContent, designContent);
    if (!taskResult.valid) {
      tasksErrors.push(...taskResult.errors);
    }
  }

  // Cross-validate traceability
  const orphans: string[] = [];
  const circular: string[] = [];

  // Check for orphaned design elements (no tasks implement them)
  const desIds = designContent ? designContent.match(/DES-\d+/g) || [] : [];
  const taskDesIds = tasksContent ? tasksContent.match(/_Implements:\s*DES-\d+/g) || [] : [];

  for (const desId of desIds) {
    const hasTask = taskDesIds.some(t => t.includes(desId));
    if (!hasTask) {
      const line = findLineNumber(designContent, new RegExp(desId));
      orphans.push(addLineInfo(formatError({
        errorType: "Traceability Error",
        context: `${desId} has no implementing tasks`,
        suggestedFix: `Add tasks with _Implements: ${desId}_ tag`,
        skillDocLink: SKILL_DOCS.design
      }), line));
    }
  }

  return {
    valid: overallErrors.length === 0 && requirementsErrors.length === 0 && designErrors.length === 0 && tasksErrors.length === 0,
    overallErrors,
    requirementsErrors,
    designErrors,
    tasksErrors,
    traceabilityReport: {
      complete: orphans.length === 0,
      orphans,
      circular
    }
  };
}

const TOOL_DEFINITIONS = [
  {
    name: "verify_spec_structure",
    description: "Validates spec folder structure and file existence (requires: requirements.md, design.md, tasks.md in specs/changes/<slug>/).",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Short identifier for the spec (e.g., 'rate-limiter-impl')."
        },
        targetDir: {
          type: "string",
          description: "Base directory to check (default: current working directory)."
        }
      },
      required: ["slug"]
    }
  },
  {
    name: "verify_requirements_file",
    description: "Validates a requirements.md file has all required sections, EARS patterns, and proper numbering.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The Markdown content of requirements.md file."
        }
      },
      required: ["content"]
    }
  },
  {
    name: "verify_design_file",
    description: "Validates a design.md file has all required sections, Mermaid diagrams, design element numbering, and traceability links.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The Markdown content of design.md file."
        },
        requirementsContent: {
          type: "string",
          description: "The content from requirements.md for traceability verification (optional but recommended)."
        }
      },
      required: ["content"]
    }
  },
  {
    name: "verify_tasks_file",
    description: "Validates a tasks.md file has proper structure, numbering, traceability, and includes Final Checkpoint phase.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The Markdown content of tasks.md file."
        },
        designContent: {
          type: "string",
          description: "The content from design.md for traceability verification (optional but recommended)."
        }
      },
      required: ["content"]
    }
  },
  {
    name: "verify_complete_spec",
    description: "Validates all three spec files (requirements.md, design.md, tasks.md) together for complete workflow validation and cross-file traceability.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Short identifier for the spec (e.g., 'rate-limiter-impl')."
        },
        targetDir: {
          type: "string",
          description: "Base directory to check (default: current working directory)."
        }
      },
      required: ["slug"]
    }
  }
] as const;

async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "verify_spec_structure": {
      const result = await verifySpecStructure(args.slug as string, args.targetDir as string | undefined);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.valid
      };
    }
    case "verify_requirements_file": {
      const result = verifyRequirementsFile(args.content as string);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.valid
      };
    }
    case "verify_design_file": {
      const result = verifyDesignFile(args.content as string, args.requirementsContent as string | undefined);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.valid
      };
    }
    case "verify_tasks_file": {
      const result = verifyTasksFile(args.content as string, args.designContent as string | undefined);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.valid
      };
    }
    case "verify_complete_spec": {
      const result = await verifyCompleteSpec(args.slug as string, args.targetDir as string | undefined);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: !result.valid
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_DEFINITIONS
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  return executeTool(name, args as Record<string, unknown>);
});

export {
  TOOL_DEFINITIONS,
  executeTool,
  verifySpecStructure,
  verifyRequirementsFile,
  verifyDesignFile,
  verifyTasksFile,
  verifyCompleteSpec
};

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Spec-Driven Steroids MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP Server:", error);
  process.exit(1);
});
