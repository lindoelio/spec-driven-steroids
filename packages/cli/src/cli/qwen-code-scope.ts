import os from "os"
import path from "path"

/**
 * Injection scope options for Qwen Code platform.
 */
export enum QwenCodeInjectionScope {
  USER = "user",
  PROJECT = "project",
}

/**
 * Result of Qwen Code injection operation.
 */
export interface QwenCodeInjectionResult {
  scope: QwenCodeInjectionScope
  mcpConfigPath: string
  skillsPath: string
  templatesCopied: boolean
}

/**
 * Returns the Qwen Code global MCP configuration file path.
 * Uses ~/.qwen/mcp_config.json
 */
export function getQwenCodeGlobalMcpPath(): string {
  return path.join(os.homedir(), ".qwen", "mcp_config.json")
}

/**
 * Returns the Qwen Code global configuration directory path.
 */
export function getQwenCodeGlobalConfigDir(): string {
  return path.join(os.homedir(), ".qwen")
}

/**
 * Returns the Qwen Code user-level skills directory.
 * Skills are stored in ~/.qwen/skills/ for user-level access.
 */
export function getQwenCodeUserSkillsDir(): string {
  return path.join(os.homedir(), ".qwen", "skills")
}

/**
 * Returns the Qwen Code project-level skills directory path.
 */
export function getQwenCodeProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".qwen", "skills")
}

/**
 * Returns the Qwen Code project-level MCP configuration file path.
 */
export function getQwenCodeProjectMcpPath(targetDir: string): string {
  return path.join(targetDir, ".qwen", "mcp_config.json")
}