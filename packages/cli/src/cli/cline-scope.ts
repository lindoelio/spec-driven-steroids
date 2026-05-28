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

export function getClineUserAgentsDir(): string {
  return path.join(os.homedir(), ".cline", "agents")
}

export function getClineUserCommandsDir(): string {
  return path.join(os.homedir(), ".cline", "commands")
}

export function getClineProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".cline", "skills")
}

export function getClineProjectAgentsDir(targetDir: string): string {
  return path.join(targetDir, ".cline", "agents")
}

export function getClineProjectCommandsDir(targetDir: string): string {
  return path.join(targetDir, ".cline", "commands")
}
