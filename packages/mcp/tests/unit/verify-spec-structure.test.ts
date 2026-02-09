import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifySpecStructure } from '-dist/index.js';
import { mockFs } from '@spec-driven-steroids/test-utils';

describe('MCP Unit: verifySpecStructure', () => {
    let targetDir: string;

    beforeEach(async () => {
        targetDir = await mockFs.createTempDir();
    });

    afterEach(async () => {
        await mockFs.cleanup();
    });

    describe('directory validation', () => {
        it('validates existing spec directory', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('detects missing spec directory', async () => {
            const result = await verifySpecStructure('nonexistent', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('does not exist');
        });

        it('detects path that is not a directory', async () => {
            const filePath = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(filePath, '# Test\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('not a directory');
        });
    });

    describe('required files', () => {
        it('validates all required files present', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(true);
        });

        it('detects missing requirements.md', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('requirements.md'))).toBe(true);
        });

        it('detects missing design.md', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('design.md'))).toBe(true);
        });

        it('detects missing tasks.md', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('tasks.md'))).toBe(true);
        });

        it('detects all files missing', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(specDir, ''); // Just create directory

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBe(3);
        });
    });

    describe('unexpected files', () => {
        it('detects unexpected files in spec directory', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');
            await mockFs.writeFile(`${specDir}/extra.md`, '# Extra\n');
            await mockFs.writeFile(`${specDir}/notes.txt`, '# Notes\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Unexpected files'))).toBe(true);
            expect(result.errors[0]).toContain('extra.md');
            expect(result.errors[0]).toContain('notes.txt');
        });

        it('validates directory with only required files', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('handles spec name with special characters', async () => {
            const specName = 'test-spec_with.special@chars';
            const specDir = `${targetDir}/specs/changes/${specName}`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            const result = await verifySpecStructure(specName, targetDir);
            expect(result.valid).toBe(true);
        });

        it('handles default target directory (current working directory)', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            process.chdir(targetDir);
            const result = await verifySpecStructure('test-spec');
            expect(result.valid).toBe(true);
        });

        it('handles files with content', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n\nThis is content.');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n\nMore content.');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n\nEven more content.');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(true);
        });

        it('handles empty files', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '');
            await mockFs.writeFile(`${specDir}/design.md`, '');
            await mockFs.writeFile(`${specDir}/tasks.md`, '');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(true);
        });

        it('handles nested spec directory structure', async () => {
            const specDir = `${targetDir}/specs/changes/nested/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');
            await mockFs.writeFile(`${specDir}/design.md`, '# Design\n');
            await mockFs.writeFile(`${specDir}/tasks.md`, '# Tasks\n');

            const result = await verifySpecStructure('nested/test-spec', targetDir);
            expect(result.valid).toBe(true);
        });
    });

    describe('error messages', () => {
        it('includes skill doc links in error messages', async () => {
            const specDir = `${targetDir}/specs/changes/test-spec`;
            await mockFs.writeFile(`${specDir}/requirements.md`, '# Requirements\n');

            const result = await verifySpecStructure('test-spec', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('SKILL.md'))).toBe(true);
        });

        it('provides clear suggested fixes', async () => {
            const result = await verifySpecStructure('nonexistent', targetDir);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Create spec directory');
        });
    });
});
