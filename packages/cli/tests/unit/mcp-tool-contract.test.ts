import { describe, expect, it } from 'vitest';
import { TOOL_DEFINITIONS, executeTool } from '-dist/index.js';

describe('MCP Unit: tool contract', () => {
    it('registers all expected internal MCP tools', () => {
        const names = TOOL_DEFINITIONS.map((tool) => tool.name);

        expect(names).toEqual([
            'verify_spec_structure',
            'verify_requirements_file',
            'verify_design_file',
            'verify_tasks_file',
            'verify_complete_spec'
        ]);
    });

    it('dispatches verify_tasks_file with designContent support', async () => {
        const tasksContent = `## Overview

Test.

## Phase 1: Build

- [ ] 1.1 Task
  - _Implements: DES-99_

## Phase 2: Final Checkpoint

- [ ] 2.1 Verify
`;

        const designContent = `# Design Document

## System Architecture

### DES-1: Real element
`;

        const response = await executeTool('verify_tasks_file', {
            content: tasksContent,
            designContent
        });

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain('DES-99');
    });

    it('throws on unknown tool dispatch', async () => {
        await expect(executeTool('does_not_exist', {})).rejects.toThrow('Unknown tool');
    });
});
