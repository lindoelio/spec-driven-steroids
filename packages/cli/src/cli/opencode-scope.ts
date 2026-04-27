import os from "os";
import path from "path";

export enum OpenCodeInjectionScope {
  PROJECT = "project",
  GLOBAL = "global",
}

export function getOpenCodeGlobalConfigDir(): string {
  return path.join(os.homedir(), ".config", "opencode");
}
