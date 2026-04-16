import os from "os";
import path from "path";

/**
 * Injection scope options for GitHub Copilot platforms.
 */
export enum GitHubCopilotInjectionScope {
  PROJECT = "project",
  GLOBAL = "global",
}

/**
 * Result of GitHub Copilot injection operation.
 */
export interface GitHubCopilotInjectionResult {
  scope: GitHubCopilotInjectionScope;
  mcpConfigPath: string;
  artifactsPath: string;
  templatesCopied: boolean;
}

/**
 * Returns the VS Code user profile MCP configuration file path.
 * On VS Code, global MCP servers are defined in User/mcp.json.
 */
export function getVSCodeUserProfileMcpPath(): string {
  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Code", "User", "mcp.json");
  }
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Code",
      "User",
      "mcp.json",
    );
  }
  return path.join(os.homedir(), ".config", "Code", "User", "mcp.json");
}

/**
 * Returns the VS Code user profile directory.
 */
export function getVSCodeUserProfileDir(): string {
  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Code", "User");
  }
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Code",
      "User",
    );
  }
  return path.join(os.homedir(), ".config", "Code", "User");
}

/**
 * Returns the VS Code global prompts directory for GitHub Copilot.
 * Custom prompts for Chat UI are stored in User/prompts/.
 */
export function getVSCodeGlobalPromptsDir(): string {
  return path.join(getVSCodeUserProfileDir(), "prompts");
}

/**
 * Returns the global GitHub Copilot skills directory.
 * Skills are stored in ~/.copilot/skills/ regardless of VS Code platform.
 */
export function getCopilotGlobalSkillsDir(): string {
  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE || os.homedir();
    return path.join(userProfile, ".copilot", "skills");
  }
  return path.join(os.homedir(), ".copilot", "skills");
}

/**
 * Returns the global GitHub Copilot configuration directory for VS Code.
 * DEPRECATED: This path is no longer used for global Copilot injection.
 * Use getVSCodeGlobalPromptsDir() for prompts and getCopilotGlobalSkillsDir() for skills.
 */
export function getVSCodeGlobalArtifactsDir(): string {
  return path.join(
    getVSCodeUserProfileDir(),
    "globalStorage",
    "github.copilot",
  );
}

/**
 * Returns the JetBrains global MCP configuration file path.
 * Uses the same path as the existing JetBrains MCP configuration.
 */
export function getJetBrainsGlobalMcpPath(): string {
  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "github-copilot", "intellij", "mcp.json");
  }
  return path.join(
    os.homedir(),
    ".config",
    "github-copilot",
    "intellij",
    "mcp.json",
  );
}

/**
 * Scope selection prompt options for inquirer.
 */
export const GITHUB_SCOPE_PROMPT_OPTIONS = [
  { name: "Global (recommended)", value: GitHubCopilotInjectionScope.GLOBAL },
  { name: "Project-level", value: GitHubCopilotInjectionScope.PROJECT },
];

/**
 * Default injection scope for GitHub Copilot platforms.
 */
export const DEFAULT_GITHUB_SCOPE = GitHubCopilotInjectionScope.GLOBAL;
