import os from 'os';
import path from 'path';

/**
 * Result of Antigravity injection operation.
 */
export interface AntigravityInjectionResult {
  configPath: string;
  templatesCopied: boolean;
  skillsPath?: string;
}

/**
 * Returns the global Antigravity configuration file path.
 * This is the platform's standard user-level MCP configuration path,
 * used even for project-level injection operations.
 */
export function getAntigravityGlobalConfigPath(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
}

/**
 * Returns the global Antigravity configuration directory path.
 */
export function getAntigravityGlobalConfigDir(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity');
}