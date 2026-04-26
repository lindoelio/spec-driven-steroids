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
 * Returns the Gemini CLI global settings file path.
 * MCP servers are configured under mcpServers in ~/.gemini/settings.json.
 */
export function getGeminiCliGlobalMcpPath(): string {
  return path.join(os.homedir(), ".gemini", "settings.json")
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
 * Returns the Gemini CLI project-level settings file path.
 */
export function getGeminiCliProjectMcpPath(targetDir: string): string {
  return path.join(targetDir, ".gemini", "settings.json")
}

/**
 * Returns the Gemini CLI user-level agents directory.
 * Agents are stored in ~/.gemini/agents/ for user-level access.
 */
export function getGeminiCliUserAgentsDir(): string {
  return path.join(os.homedir(), ".gemini", "agents")
}

/**
 * Returns the Gemini CLI user-level commands directory.
 * Commands are stored in ~/.gemini/commands/ for user-level access.
 */
export function getGeminiCliUserCommandsDir(): string {
  return path.join(os.homedir(), ".gemini", "commands")
}

/**
 * Returns the Gemini CLI project-level agents directory path.
 */
export function getGeminiCliProjectAgentsDir(targetDir: string): string {
  return path.join(targetDir, ".gemini", "agents")
}

/**
 * Returns the Gemini CLI project-level commands directory path.
 */
export function getGeminiCliProjectCommandsDir(targetDir: string): string {
  return path.join(targetDir, ".gemini", "commands")
}
