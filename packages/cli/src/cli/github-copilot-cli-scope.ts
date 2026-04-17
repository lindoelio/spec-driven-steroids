import os from "os"
import path from "path"

/**
 * Injection scope options for GitHub Copilot CLI platform.
 */
export enum GitHubCopilotCliInjectionScope {
  USER = "user",
  PROJECT = "project",
}

/**
 * Result of GitHub Copilot CLI injection operation.
 */
export interface GitHubCopilotCliInjectionResult {
  scope: GitHubCopilotCliInjectionScope
  mcpConfigPath: string
  skillsPath: string
  templatesCopied: boolean
}

/**
 * Returns the GitHub Copilot CLI global MCP configuration file path.
 * Uses ~/.config/github-copilot/mcp.json
 */
export function getGitHubCopilotCliGlobalMcpPath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    return path.join(appData, "github-copilot", "mcp.json")
  }
  return path.join(os.homedir(), ".config", "github-copilot", "mcp.json")
}

/**
 * Returns the GitHub Copilot CLI global configuration directory path.
 */
export function getGitHubCopilotCliGlobalConfigDir(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    return path.join(appData, "github-copilot")
  }
  return path.join(os.homedir(), ".config", "github-copilot")
}

/**
 * Returns the GitHub Copilot CLI user-level skills directory.
 * Skills are stored in ~/.copilot/skills/ for user-level access.
 */
export function getGitHubCopilotCliUserSkillsDir(): string {
  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE || os.homedir()
    return path.join(userProfile, ".copilot", "skills")
  }
  return path.join(os.homedir(), ".copilot", "skills")
}

/**
 * Returns the GitHub Copilot CLI project-level skills directory path.
 */
export function getGitHubCopilotCliProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".github", "skills")
}

/**
 * Returns the GitHub Copilot CLI project-level MCP configuration file path.
 */
export function getGitHubCopilotCliProjectMcpPath(targetDir: string): string {
  return path.join(targetDir, ".github", "mcp.json")
}