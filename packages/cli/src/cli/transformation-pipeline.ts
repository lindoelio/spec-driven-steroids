import fs from 'fs-extra';
import path from 'path';
import { getPlatformConfig, type PlatformConfig } from './platform-config.js';
import { transform } from './format-transformer.js';

/**
 * Universal prompt source configuration.
 */
interface UniversalSource {
  /** Path to the universal source file (relative to templates dir) */
  sourcePath: string;
  /** Output type: 'agent', 'spec-driven-command', or 'inject-guidelines-command' */
  outputType: 'agent' | 'spec-driven-command' | 'inject-guidelines-command';
}

/** Universal sources to transform for each platform */
const UNIVERSAL_SOURCES: UniversalSource[] = [
  {
    sourcePath: 'universal/agents/spec-driven.agent.md',
    outputType: 'agent'
  },
  {
    sourcePath: 'universal/commands/spec-driven.command.md',
    outputType: 'spec-driven-command'
  },
  {
    sourcePath: 'universal/commands/inject-guidelines.command.md',
    outputType: 'inject-guidelines-command'
  }
];

/**
 * Result of transforming a single prompt for a single platform.
 */
export interface PlatformTransformResult {
  platformId: string;
  sourcePath: string;
  outputPath: string;
  success: boolean;
  bodyPreserved: boolean;
  error?: string;
}

/**
 * Options for transforming templates for a platform.
 */
export interface TransformOptions {
  /** Output types to skip (e.g., ['inject-guidelines-command'] to skip prompts) */
  skipOutputTypes?: string[];
}

/**
 * Transform all universal prompts for a specific platform.
 * 
 * @param platformId - Platform identifier (e.g., 'github-vscode', 'claudecode')
 * @param templatesDir - Absolute path to the templates directory
 * @param destDir - Destination directory for transformed outputs
 * @param options - Transform options
 * @returns Array of transform results
 */
export async function transformForPlatform(
  platformId: string,
  templatesDir: string,
  destDir: string,
  options?: TransformOptions
): Promise<PlatformTransformResult[]> {
  const config = getPlatformConfig(platformId);
  if (!config) {
    return [{
      platformId,
      sourcePath: '',
      outputPath: '',
      success: false,
      bodyPreserved: false,
      error: `Unknown platform: ${platformId}`
    }];
  }
  
  const results: PlatformTransformResult[] = [];
  const skipOutputTypes = options?.skipOutputTypes || [];
  
  // For Antigravity, the spec-driven command IS the agent (same file).
  // Skip creating a separate spec-driven-command to avoid overwriting the agent.
  const skipSpecDrivenCommand = config.agentDirectory === config.commandDirectory && 
                                config.agentFilename === config.specDrivenCommandFilename;
  
  for (const source of UNIVERSAL_SOURCES) {
    // Skip spec-driven-command for platforms like Antigravity where agent and command are the same file
    if (source.outputType === 'spec-driven-command' && skipSpecDrivenCommand) {
      continue;
    }
    // Skip any output types specified in options
    if (skipOutputTypes.includes(source.outputType)) {
      continue;
    }
    const result = await transformSource(source, config, templatesDir, destDir);
    results.push(result);
  }
  
  return results;
}

/**
 * Transform a single universal source for a platform.
 */
async function transformSource(
  source: UniversalSource,
  config: PlatformConfig,
  templatesDir: string,
  destDir: string
): Promise<PlatformTransformResult> {
  const sourcePath = path.join(templatesDir, source.sourcePath);
  
  try {
    // Read the universal source
    if (!await fs.pathExists(sourcePath)) {
      return {
        platformId: config.id,
        sourcePath: source.sourcePath,
        outputPath: '',
        success: false,
        bodyPreserved: false,
        error: `Source file not found: ${sourcePath}`
      };
    }
    
    const rawContent = await fs.readFile(sourcePath, 'utf-8');
    const body = extractBody(rawContent);
    
    // Transform
    const transformResult = transform(body, config);
    
    // Determine output path based on output type
    let outputDir: string;
    let outputFilename: string;
    
    if (source.outputType === 'agent') {
      outputDir = config.agentDirectory;
      outputFilename = config.agentFilename;
    } else {
      outputDir = config.commandDirectory;
      outputFilename = source.outputType === 'spec-driven-command'
        ? config.specDrivenCommandFilename
        : config.injectGuidelinesCommandFilename;
    }
    
    const outputPath = path.join(destDir, outputDir, outputFilename);
    
    // Write transformed content
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, transformResult.content, 'utf-8');
    
    return {
      platformId: config.id,
      sourcePath: source.sourcePath,
      outputPath,
      success: true,
      bodyPreserved: transformResult.bodyPreserved
    };
  } catch (error) {
    return {
      platformId: config.id,
      sourcePath: source.sourcePath,
      outputPath: '',
      success: false,
      bodyPreserved: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Extract body content from a universal prompt file.
 * Strips YAML frontmatter if present.
 */
function extractBody(content: string): string {
  // Check for YAML frontmatter
  if (content.startsWith('---')) {
    const endFrontmatter = content.indexOf('---', 3);
    if (endFrontmatter !== -1) {
      return content.slice(endFrontmatter + 3).trim();
    }
  }
  return content.trim();
}

/**
 * Transform templates for all specified platforms.
 * 
 * @param platforms - Array of platform IDs to transform for
 * @param templatesDir - Absolute path to the templates directory
 * @param getDestDir - Function to get destination directory for each platform
 * @param options - Transform options
 * @returns Array of all transform results
 */
export async function transformTemplates(
  platforms: string[],
  templatesDir: string,
  getDestDir: (platformId: string) => string,
  options?: TransformOptions
): Promise<PlatformTransformResult[]> {
  const allResults: PlatformTransformResult[] = [];
  
  for (const platformId of platforms) {
    const destDir = getDestDir(platformId);
    const results = await transformForPlatform(platformId, templatesDir, destDir, options);
    allResults.push(...results);
  }
  
  return allResults;
}