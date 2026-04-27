import os from "os"
import path from "path"

export enum GeminiCliInjectionScope {
  USER = "user",
  PROJECT = "project",
}

export function getGeminiCliGlobalConfigDir(): string {
  return path.join(os.homedir(), ".gemini")
}

export function getGeminiCliUserSkillsDir(): string {
  return path.join(os.homedir(), ".gemini", "skills")
}

export function getGeminiCliAgentsAliasDir(): string {
  return path.join(os.homedir(), ".agents", "skills")
}

export function getGeminiCliProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".gemini", "skills")
}

export function getGeminiCliUserAgentsDir(): string {
  return path.join(os.homedir(), ".gemini", "agents")
}

export function getGeminiCliUserCommandsDir(): string {
  return path.join(os.homedir(), ".gemini", "commands")
}

export function getGeminiCliProjectAgentsDir(targetDir: string): string {
  return path.join(targetDir, ".gemini", "agents")
}

export function getGeminiCliProjectCommandsDir(targetDir: string): string {
  return path.join(targetDir, ".gemini", "commands")
}
