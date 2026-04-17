import os from "os"
import path from "path"

/**
 * Injection scope options for Gemini CLI platform.
 */
export enum GeminiCliInjectionScope {
  USER = "user",
  PROJECT = "project",
}

/**
 * Result of Gemini CLI injection operation.
 */
export interface GeminiCliInjectionResult {
  scope: GeminiCliInjectionScope
  mcpConfigPath: string
  skillsPath: string
  templatesCopied: boolean
}

/**
 * Returns the Gemini CLI global MCP configuration file path.
 * Uses ~/.gemini/mcp_config.json
 */
export function getGeminiCliGlobalMcpPath(): string {
  return path.join(os.homedir(), ".gemini", "mcp_config.json")
}

/**
 * Returns the Gemini CLI global configuration directory path.
 */
export function getGeminiCliGlobalConfigDir(): string {
  return path.join(os.homedir(), ".gemini")
}

/**
 * Returns the Gemini CLI user-level skills directory.
 * Skills are stored in ~/.gemini/skills/ for user-level access.
 */
export function getGeminiCliUserSkillsDir(): string {
  return path.join(os.homedir(), ".gemini", "skills")
}

/**
 * Returns the Gemini CLI agents alias directory.
 * This is an alternative location some Gemini CLI versions check.
 */
export function getGeminiCliAgentsAliasDir(): string {
  return path.join(os.homedir(), ".agents", "skills")
}

/**
 * Returns the Gemini CLI project-level skills directory path.
 */
export function getGeminiCliProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".gemini", "skills")
}

/**
 * Returns the Gemini CLI project-level MCP configuration file path.
 */
export function getGeminiCliProjectMcpPath(targetDir: string): string {
  return path.join(targetDir, ".gemini", "mcp_config.json")
}