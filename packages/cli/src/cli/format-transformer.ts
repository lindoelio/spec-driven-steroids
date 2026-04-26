import type { PlatformConfig } from './platform-config.js';

/**
 * Transform body content to markdown format with YAML frontmatter.
 * 
 * @param body - The prompt body content
 * @param config - Platform configuration
 * @returns Transformed content with YAML frontmatter
 */
export function transformToMarkdown(body: string, config: PlatformConfig, sourceFrontmatter: Record<string, string> = {}, outputType?: string): string {
  const frontmatterLines: string[] = ['---'];
  
  let name = config.frontmatter.fields.name;
  let description = config.frontmatter.fields.description;

  if (outputType === 'inject-guidelines-command') {
    name = 'inject-guidelines';
    description = sourceFrontmatter.description || description;
  } else if (outputType === 'spec-driven-command' || outputType === 'agent') {
    description = sourceFrontmatter.description || description;
  }

  if (name) frontmatterLines.push(`name: ${escapeYamlString(name)}`);
  if (description) frontmatterLines.push(`description: ${escapeYamlString(description)}`);

  // Add standard fields not already added
  for (const [key, value] of Object.entries(sourceFrontmatter)) {
    if (key !== 'name' && key !== 'description' && !config.frontmatter.additionalFields?.[key]) {
      frontmatterLines.push(`${key}: ${escapeYamlString(value)}`);
    }
  }
  
  // Add additional fields if present
  if (config.frontmatter.additionalFields) {
    for (const [key, value] of Object.entries(config.frontmatter.additionalFields)) {
      frontmatterLines.push(`${key}: ${escapeYamlString(value)}`);
    }
  }
  
  frontmatterLines.push('---');
  
  const frontmatter = frontmatterLines.join('\n');
  return `${frontmatter}\n\n${body}`;
}

/**
 * Escape a string for YAML frontmatter.
 * Handles quotes and special characters.
 */
function escapeYamlString(value: string): string {
  // If the value contains newlines, quotes, or special chars, wrap in quotes
  if (value.includes('\n') || value.includes('"') || value.includes("'") || value.includes(':')) {
    // Escape double quotes and wrap in double quotes
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return value;
}

/**
 * Verify that body content is preserved through transformation.
 * Returns true if the body appears unchanged in the output.
 */
export function verifyBodyPreserved(originalBody: string, transformedContent: string, format: 'markdown' | 'toml'): boolean {
  if (format === 'markdown') {
    // For markdown, body should appear after the closing ---
    const frontmatterEnd = transformedContent.indexOf('---\n', 1);
    if (frontmatterEnd === -1) return false;
    const bodyStart = transformedContent.indexOf('\n', frontmatterEnd + 4);
    if (bodyStart === -1) return false;
    const extractedBody = transformedContent.slice(bodyStart + 1);
    return extractedBody.trim() === originalBody.trim();
  }
  if (format === 'toml') {
    // For TOML, body is inside developer_instructions multi-line string
    const match = transformedContent.match(/developer_instructions\s*=\s*"""\n([\s\S]*?)\n"""/);
    if (!match) return false;
    return match[1].trim() === originalBody.trim();
  }
  return false;
}

/**
 * Transform body content to TOML format for Codex platform.
 * Wraps body in developer_instructions multi-line string with proper escaping.
 * 
 * @param body - The prompt body content
 * @param config - Platform configuration
 * @returns Transformed content in TOML format
 */
export function transformToToml(body: string, config: PlatformConfig, sourceFrontmatter: Record<string, string> = {}, outputType?: string): string {
  const lines: string[] = [];
  
  // Base fields
  let name = config.frontmatter.fields.name || 'spec-driven';
  let description = config.frontmatter.fields.description || '';

  if (outputType === 'inject-guidelines-command') {
    name = 'inject-guidelines';
    description = sourceFrontmatter.description || description;
  } else if (outputType === 'spec-driven-command' || outputType === 'agent') {
    description = sourceFrontmatter.description || description;
  }

  // Add name field
  lines.push(`name = "${escapeTomlString(name)}"`);
  
  // Add description field
  lines.push(`description = "${escapeTomlString(description)}"`);
  
  // Add developer_instructions as multi-line string
  lines.push('developer_instructions = """');
  lines.push(escapeTomlMultilineBody(body));
  lines.push('"""');
  
  // Add sandbox_mode
  lines.push('sandbox_mode = "workspace-write"');
  
  return lines.join('\n');
}

/**
 * Escape a string for TOML format.
 * Handles backslashes, double quotes, and special characters.
 */
function escapeTomlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Transform command content to TOML format for Gemini CLI custom commands.
 * Uses description and prompt fields per Gemini CLI custom commands spec.
 *
 * @param body - The prompt body content
 * @param description - The command description
 * @returns Transformed content in TOML format for Gemini CLI
 */
export function transformToTomlCommand(body: string, description: string): string {
  const lines: string[] = [];

  // Add description field
  lines.push(`description = "${escapeTomlString(description)}"`);

  // Add prompt as multi-line string
  lines.push('prompt = """');
  lines.push(escapeTomlMultilineBody(body));
  lines.push('"""');

  return lines.join('\n');
}

function escapeTomlMultilineBody(value: string): string {
  return value.replace(/"""/g, '\\"\\"\\"');
}

/**
 * Transform result containing the transformed content and verification status.
 */
export interface TransformResult {
  content: string;
  bodyPreserved: boolean;
}

/**
 * Transform body content to the appropriate format based on platform configuration.
 * Automatically selects markdown or TOML transformer and verifies body preservation.
 * 
 * @param body - The prompt body content
 * @param config - Platform configuration
 * @returns Transform result with content and verification status
 */
export function transform(body: string, config: PlatformConfig, sourceFrontmatter: Record<string, string> = {}, outputType?: string): TransformResult {
  let content: string;
  let format: 'markdown' | 'toml';
  
  if (config.format === 'toml') {
    content = transformToToml(body, config, sourceFrontmatter, outputType);
    format = 'toml';
  } else {
    content = transformToMarkdown(body, config, sourceFrontmatter, outputType);
    format = 'markdown';
  }
  
  const bodyPreserved = verifyBodyPreserved(body, content, format);
  
  return {
    content,
    bodyPreserved
  };
}
