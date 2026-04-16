import os from "os";
import path from "path";

/**
 * Injection scope options for OpenCode platform.
 */
export enum OpenCodeInjectionScope {
  PROJECT = "project",
  GLOBAL = "global",
}

/**
 * Result of OpenCode injection operation.
 */
export interface OpenCodeInjectionResult {
  scope: OpenCodeInjectionScope;
  configPath: string;
  templatesCopied: boolean;
  skillsPath?: string;
}

/**
 * Returns the global OpenCode configuration file path.
 * Follows XDG Base Directory Specification on Unix-like systems.
 */
export function getOpenCodeGlobalConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "opencode.json");
}

/**
 * Returns the global OpenCode configuration directory path.
 */
export function getOpenCodeGlobalConfigDir(): string {
  return path.join(os.homedir(), ".config", "opencode");
}

/**
 * Scope selection prompt options for inquirer.
 */
export const SCOPE_PROMPT_OPTIONS = [
  { name: "Global (recommended)", value: OpenCodeInjectionScope.GLOBAL },
  { name: "Project-level", value: OpenCodeInjectionScope.PROJECT },
];

/**
 * Default injection scope.
 */
export const DEFAULT_SCOPE = OpenCodeInjectionScope.GLOBAL;
