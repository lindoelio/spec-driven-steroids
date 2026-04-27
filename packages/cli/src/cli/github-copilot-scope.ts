import os from "os";
import path from "path";

export enum GitHubCopilotInjectionScope {
  PROJECT = "project",
  GLOBAL = "global",
}

function getVSCodeUserProfileDir(): string {
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

export function getVSCodeGlobalPromptsDir(): string {
  return path.join(getVSCodeUserProfileDir(), "prompts");
}

export function getCopilotGlobalSkillsDir(): string {
  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE || os.homedir();
    return path.join(userProfile, ".copilot", "skills");
  }
  return path.join(os.homedir(), ".copilot", "skills");
}
