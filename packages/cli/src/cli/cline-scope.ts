import os from "os"
import path from "path"

export enum ClineInjectionScope {
  USER = "user",
  PROJECT = "project",
}

export function getClineGlobalConfigDir(): string {
  return path.join(os.homedir(), ".cline")
}

export function getClineUserSkillsDir(): string {
  return path.join(os.homedir(), ".cline", "skills")
}

export function getClineProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".cline", "skills")
}
