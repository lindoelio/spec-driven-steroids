import os from "os"
import path from "path"

export enum GitHubCopilotCliInjectionScope {
  USER = "user",
  PROJECT = "project",
}

export function getGitHubCopilotCliGlobalConfigDir(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    return path.join(appData, "github-copilot")
  }
  return path.join(os.homedir(), ".config", "github-copilot")
}

export function getGitHubCopilotCliUserSkillsDir(): string {
  return path.join(getGitHubCopilotCliGlobalConfigDir(), "skills")
}

export function getGitHubCopilotCliProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".github", "skills")
}
