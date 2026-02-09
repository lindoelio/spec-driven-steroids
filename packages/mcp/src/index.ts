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

function formatError(error: FormattedError): string {
  const { errorType, context, suggestedFix, skillDocLink } = error;
  let message = `[${errorType}] → ${context} → ${suggestedFix}`;

  if (skillDocLink) {
    message += `\n   See: ${skillDocLink}`;
  }

  return message;
}

function findLineNumber(content: string, pattern: RegExp): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return -1;
}

function addLineInfo(error: string, line: number): string {
  if (line > 0) {
    return `${error}\n   Line: ${line}`;
  }
  return error;
}

const server = new Server(
  {
    name: "spec-driven-steroids-mcp",
    version: "0.1.0",
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
  try {
    const stats = await fs.stat(specDir);
    if (!stats.isDirectory()) {
      errors.push(formatError({
        errorType: "Structure Error",
        context: `Path is not a directory: ${specDir}`,
        suggestedFix: "Create spec directory with: mkdir -p specs/changes/{slug}"
      }));
      return { valid: false, errors, warnings };
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
  const files = await fs.readdir(specDir);

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

  // Check for required sections
  if (!content.includes('## Introduction')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Introduction section not found",
      suggestedFix: "Add ## Introduction section at top with project background and objectives",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }
  if (!content.includes('## Glossary')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Glossary section not found",
      suggestedFix: "Add ## Glossary section defining key terms",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }
  if (!content.includes('## Requirements')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Requirements section not found",
      suggestedFix: "Add ## Requirements section with REQ-X numbering",
      skillDocLink: SKILL_DOCS.requirements
    }));
  }

  // Extract requirement IDs
  const reqMatches = content.match(/REQ-\d+/g);
  if (reqMatches) {
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
  const acceptanceCriteriaMatches = content.match(/\d+\.\d+/g);
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

  // Check for required sections
  if (!content.includes('## Overview')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Overview section not found",
      suggestedFix: "Add ## Overview section describing high-level design approach",
      skillDocLink: SKILL_DOCS.design
    }));
  }
  if (!content.includes('## System Architecture')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "System Architecture section not found",
      suggestedFix: "Add ## System Architecture section with Mermaid diagrams",
      skillDocLink: SKILL_DOCS.design
    }));
  }
  if (!content.includes('## Code Anatomy')) {
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
  const desMatches = content.match(/DES-\d+/g);
  if (!desMatches || desMatches.length === 0) {
    errors.push(formatError({
      errorType: "Format Error",
      context: "No DES-X design element IDs found",
      suggestedFix: "Number design elements with DES-1, DES-2, etc.",
      skillDocLink: SKILL_DOCS.design
    }));
  } else {
    const uniqueDes = [...new Set(desMatches)];

    // Extract requirement IDs from requirements content
    const reqIds: string[] = requirementsContent ? (requirementsContent.match(/REQ-\d+\.\d+/g) || []) : [];

    // Check traceability
    for (const desId of uniqueDes) {
      // Look for DES-X → REQ-Y.Z pattern
      const tracePattern = new RegExp(`${desId}.*→.*REQ-\\d+\\.\\d+`);
      const hasTrace = tracePattern.test(content);

      if (hasTrace) {
        const traceMatch = content.match(new RegExp(`${desId}.*→.*REQ-\\d+\\.\\d+`));
        if (traceMatch) {
          linked.push(traceMatch[0]);
        }
      } else {
        const line = findLineNumber(content, new RegExp(`${desId}`));
        orphaned.push(addLineInfo(desId, line));
      }
    }

    // Check for invalid requirement references
    const traceMatches = content.match(/DES-\d+.*→.*REQ-\d+\.\d+/g) || [];
    for (const trace of traceMatches) {
      const reqRef = trace.match(/REQ-\d+\.\d+/);
      if (reqRef && reqIds.length > 0 && !reqIds.includes(reqRef[0])) {
        const line = findLineNumber(content, new RegExp(trace));
        invalidReqRefs.push(addLineInfo(formatError({
          errorType: "Traceability Error",
          context: `${trace} refers to non-existent requirement ${reqRef[0]}`,
          suggestedFix: `Fix requirement reference or create missing ${reqRef[0]} in requirements.md`,
          skillDocLink: SKILL_DOCS.design
        }), line));
      }
    }
  }

  // Check for Traceability Matrix
  if (!content.includes('## Traceability Matrix')) {
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
function verifyTasksFile(content: string): {
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
  const phaseMatches = content.match(/### Phase \d+:/g);
  if (!phaseMatches || phaseMatches.length === 0) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "No phase headers found",
      suggestedFix: "Add phase sections using ### Phase 1:, ### Phase 2:, etc.",
      skillDocLink: SKILL_DOCS.tasks
    }));
  } else {
    phases.push(...phaseMatches);
  }

  // Check for Final Checkpoint phase
  if (!content.includes('### Phase.*Final Checkpoint') && !content.includes('Final Checkpoint')) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "Final Checkpoint phase not found",
      suggestedFix: "Add ### Phase X: Final Checkpoint section at end",
      skillDocLink: SKILL_DOCS.tasks
    }));
  }

  // Extract task IDs from checkbox format
  const taskMatches = content.match(/- \[.\] \d+\.\d+/g);
  if (!taskMatches || taskMatches.length === 0) {
    errors.push(formatError({
      errorType: "Structure Error",
      context: "No tasks in checkbox format found",
      suggestedFix: "Add tasks with format - [ ] 1.1, - [ ] 1.2, etc.",
      skillDocLink: SKILL_DOCS.tasks
    }));
  } else {
    const uniqueTasks = [...new Set(taskMatches)];

    // Check traceability
    for (const taskLine of uniqueTasks) {
      const taskId = taskLine.match(/\d+\.\d+/)?.[0] || "";
      const line = findLineNumber(content, new RegExp(taskId));

      if (taskId) {
        // Check for _Implements: DES-X, REQ-Y.Z_ pattern
        const hasTrace = /_Implements:\s*DES-\d+.*REQ-\d+\.\d+_/.test(taskLine);

        if (hasTrace) {
          const traceMatch = taskLine.match(/_Implements:\s*DES-\d+.*REQ-\d+\.\d+/);
          if (traceMatch) {
            const cleanTrace = traceMatch[0]
              .replace("_Implements: ", "")
              .replace(/_/g, "");
            linked.push(`${taskId} → ${cleanTrace}`);
          }
        } else {
          missingTraces.push(addLineInfo(taskId, line));
        }
      }
    }
  }

  // Check for valid status markers
  const invalidMarkers = content.match(/- \[[^\]] /g);
  if (invalidMarkers && invalidMarkers.length > 0) {
    errors.push(formatError({
      errorType: "Format Error",
      context: "Invalid status marker detected",
      suggestedFix: "Use only: [ ] (pending), [~] (in progress), [x] (completed)",
      skillDocLink: SKILL_DOCS.tasks
    }));
  }

  return {
    valid: errors.length === 0,
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
    const taskResult = verifyTasksFile(tasksContent);
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

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
      const result = verifyTasksFile(args.content as string);
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
});

export {
  verifySpecStructure,
  verifyRequirementsFile,
  verifyDesignFile,
  verifyTasksFile,
  verifyCompleteSpec
};

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Spec Driven Steroids MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP Server:", error);
  process.exit(1);
});
