import type { PlatformConfig } from './platform-config.js';

/**
 * Transform body content to markdown format with YAML frontmatter.
 * 
 * @param body - The prompt body content
 * @param config - Platform configuration
 * @returns Transformed content with YAML frontmatter
 */
export function transformToMarkdown(body: string, config: PlatformConfig): string {
  const frontmatterLines: string[] = ['---'];
  
  // Add standard fields
  for (const [key, value] of Object.entries(config.frontmatter.fields)) {
    frontmatterLines.push(`${key}: ${escapeYamlString(value)}`);
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
export function transformToToml(body: string, config: PlatformConfig): string {
  const lines: string[] = [];
  
  // Add name field
  const name = config.frontmatter.fields.name || 'spec-driven';
  lines.push(`name = "${escapeTomlString(name)}"`);
  
  // Add description field
  const description = config.frontmatter.fields.description || '';
  lines.push(`description = "${escapeTomlString(description)}"`);
  
  // Add developer_instructions as multi-line string
  lines.push('developer_instructions = """');
  lines.push(body);
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
export function transform(body: string, config: PlatformConfig): TransformResult {
  let content: string;
  let format: 'markdown' | 'toml';
  
  if (config.format === 'toml') {
    content = transformToToml(body, config);
    format = 'toml';
  } else {
    content = transformToMarkdown(body, config);
    format = 'markdown';
  }
  
  const bodyPreserved = verifyBodyPreserved(body, content, format);
  
  return {
    content,
    bodyPreserved
  };
}