import fs from 'fs-extra';
import path from 'path';

const FLATTENED_PROMPT_DIRS = ['agents', 'prompts'];

function flattenDestination(root: string, writtenFile: string): string | null {
  const segments = path.relative(root, writtenFile).split(path.sep);
  if (segments.length !== 2 || !FLATTENED_PROMPT_DIRS.includes(segments[0])) {
    return null;
  }
  return path.join(root, segments[1]);
}

export function resolveFlattenedPromptPaths(root: string, writtenFiles: string[]): string[] {
  return writtenFiles.map(writtenFile => flattenDestination(root, writtenFile) ?? writtenFile);
}

export async function flattenPromptFiles(root: string, writtenFiles: string[]): Promise<void> {
  for (const writtenFile of writtenFiles) {
    const destination = flattenDestination(root, writtenFile);
    if (!destination) continue;
    await fs.move(writtenFile, destination, { overwrite: true });
  }

  for (const subDir of FLATTENED_PROMPT_DIRS) {
    const subDirPath = path.join(root, subDir);
    if (!await fs.pathExists(subDirPath)) continue;
    const remaining = await fs.readdir(subDirPath).catch(() => []);
    if (remaining.length === 0) {
      await fs.remove(subDirPath);
    }
  }
}
