import os from "os"
import path from "path"

export enum QoderInjectionScope {
  USER = "user",
  PROJECT = "project",
}

export function getQoderGlobalConfigDir(): string {
  return path.join(os.homedir(), ".qoder")
}
