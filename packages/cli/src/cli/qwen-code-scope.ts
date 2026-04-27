import os from "os"
import path from "path"

export enum QwenCodeInjectionScope {
  USER = "user",
  PROJECT = "project",
}

export function getQwenCodeGlobalConfigDir(): string {
  return path.join(os.homedir(), ".qwen")
}

export function getQwenCodeUserSkillsDir(): string {
  return path.join(os.homedir(), ".qwen", "skills")
}

export function getQwenCodeProjectSkillsDir(targetDir: string): string {
  return path.join(targetDir, ".qwen", "skills")
}
