import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.join(__dirname, 'fixtures');

export async function getFixtureContent(fixtureName: string, filename: string): Promise<string> {
    const filePath = path.join(fixturesDir, fixtureName, filename);
    return await fsPromises.readFile(filePath, 'utf-8');
}

export async function getFixtureFiles(fixtureName: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const fixturePath = path.join(fixturesDir, fixtureName);
    const entries = await fsPromises.readdir(fixturePath);

    for (const entry of entries) {
        if (entry.endsWith('.md')) {
            files[entry] = await fsPromises.readFile(path.join(fixturePath, entry), 'utf-8');
        }
    }

    return files;
}

export const FIXTURES = {
    VALID_COMPLETE_SPEC: 'valid-complete-spec',
    INVALID_MISSING_FILES: 'invalid-missing-files',
    INVALID_EARS_SYNTAX: 'invalid-ears-syntax',
    INVALID_TRACEABILITY: 'invalid-traceability'
} as const;
