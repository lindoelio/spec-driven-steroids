import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockFs, getFixtureFiles, FIXTURES } from '@spec-driven-steroids/test-utils';
import { verifyCompleteSpec } from '-dist/index.js';

describe('MCP E2E: verify_complete_spec', () => {
    let targetDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        targetDir = await mockFs.createTempDir();
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await mockFs.cleanup();
    });

    it('validates a complete valid spec successfully', async () => {
        const files = await getFixtureFiles(FIXTURES.VALID_COMPLETE_SPEC);
        await mockFs.createTempSpec('rate-limiter', files, targetDir);

        const result = await verifyCompleteSpec('rate-limiter', targetDir);

        expect(result.valid).toBe(true);
        expect(result.overallErrors).toHaveLength(0);
        expect(result.requirementsErrors).toHaveLength(0);
        expect(result.designErrors).toHaveLength(0);
        expect(result.tasksErrors).toHaveLength(0);
        expect(result.traceabilityReport.complete).toBe(true);
        expect(result.traceabilityReport.orphans).toHaveLength(0);
    });

    it('detects missing files in spec directory', async () => {
        const files = await getFixtureFiles(FIXTURES.INVALID_MISSING_FILES);
        await mockFs.createTempSpec('incomplete', files, targetDir);

        const result = await verifyCompleteSpec('incomplete', targetDir);

        expect(result.valid).toBe(false);
        expect(result.overallErrors.length).toBeGreaterThan(0);
    });

    it('validates spec with invalid EARS syntax', async () => {
        const files = await getFixtureFiles(FIXTURES.INVALID_EARS_SYNTAX);
        await mockFs.createTempSpec('invalid-ears', files, targetDir);

        const result = await verifyCompleteSpec('invalid-ears', targetDir);

        expect(result.valid).toBe(false);
        expect(result.requirementsErrors.length).toBeGreaterThan(0);
    });

    it('validates spec with invalid traceability', async () => {
        const files = await getFixtureFiles(FIXTURES.INVALID_TRACEABILITY);
        await mockFs.createTempSpec('invalid-trace', files, targetDir);

        const result = await verifyCompleteSpec('invalid-trace', targetDir);

        expect(result.valid).toBe(false);
        expect(result.designErrors.length).toBeGreaterThan(0);
        expect(result.tasksErrors.length).toBeGreaterThan(0);
    });

    it('detects missing spec directory', async () => {
        const result = await verifyCompleteSpec('nonexistent', targetDir);

        expect(result.valid).toBe(false);
        expect(result.overallErrors.length).toBeGreaterThan(0);
        expect(result.overallErrors[0]).toContain('does not exist');
    });

    it('validates cross-file traceability', async () => {
        const files = await getFixtureFiles(FIXTURES.VALID_COMPLETE_SPEC);
        await mockFs.createTempSpec('rate-limiter', files, targetDir);

        const result = await verifyCompleteSpec('rate-limiter', targetDir);

        expect(result.valid).toBe(true);
        expect(result.traceabilityReport.orphans).toHaveLength(0);
        expect(result.traceabilityReport.circular).toHaveLength(0);
    });

    it('uses default target directory when not specified', async () => {
        const files = await getFixtureFiles(FIXTURES.VALID_COMPLETE_SPEC);
        await mockFs.createTempSpec('rate-limiter', files, targetDir);

        const result = await verifyCompleteSpec('rate-limiter');

        expect(result).toBeDefined();
    });
});
