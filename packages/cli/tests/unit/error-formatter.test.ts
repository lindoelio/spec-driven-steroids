import { describe, it, expect } from 'vitest';
import { formatError, findLineNumber, addLineInfo } from '@mcp-dist/index.js';

describe('MCP Unit: formatError', () => {
    it('formats error with all fields', () => {
        const error = {
            errorType: 'Structure Error',
            context: 'Missing section',
            suggestedFix: 'Add section'
        };

        const result = formatError(error);
        expect(result).toBe('[Structure Error] → Missing section → Add section');
    });

    it('formats error with skill doc link', () => {
        const error = {
            errorType: 'Format Error',
            context: 'No EARS keywords',
            suggestedFix: 'Use WHEN, IF, THEN',
            skillDocLink: '/path/to/skill.md'
        };

        const result = formatError(error);
        expect(result).toContain('[Format Error] → No EARS keywords → Use WHEN, IF, THEN');
        expect(result).toContain('See: /path/to/skill.md');
    });

    it('handles empty context and suggested fix', () => {
        const error = {
            errorType: 'Unknown Error',
            context: '',
            suggestedFix: ''
        };

        const result = formatError(error);
        expect(result).toBe('[Unknown Error] →  → ');
    });

    it('handles special characters in context', () => {
        const error = {
            errorType: 'Error',
            context: 'Test "quoted" and \'single\' quoted text',
            suggestedFix: 'Fix it'
        };

        const result = formatError(error);
        expect(result).toBe('[Error] → Test "quoted" and \'single\' quoted text → Fix it');
    });
});

describe('MCP Unit: findLineNumber', () => {
    it('finds line number for pattern at start of content', () => {
        const content = 'REQ-1\nREQ-2\nREQ-3';
        const line = findLineNumber(content, /REQ-1/);
        expect(line).toBe(1);
    });

    it('finds line number for pattern in middle of content', () => {
        const content = 'REQ-1\nREQ-2\nREQ-3';
        const line = findLineNumber(content, /REQ-2/);
        expect(line).toBe(2);
    });

    it('finds line number for pattern at end of content', () => {
        const content = 'REQ-1\nREQ-2\nREQ-3';
        const line = findLineNumber(content, /REQ-3/);
        expect(line).toBe(3);
    });

    it('finds line number for pattern with special characters', () => {
        const content = 'DES-1 → REQ-1.1\nDES-2 → REQ-2.1';
        const line = findLineNumber(content, /DES-1 → REQ-1/);
        expect(line).toBe(1);
    });

    it('returns -1 when pattern is not found', () => {
        const content = 'REQ-1\nREQ-2\nREQ-3';
        const line = findLineNumber(content, /REQ-99/);
        expect(line).toBe(-1);
    });

    it('returns -1 for empty content', () => {
        const content = '';
        const line = findLineNumber(content, /REQ-1/);
        expect(line).toBe(-1);
    });

    it('handles multi-line patterns', () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const line = findLineNumber(content, /Line 2/);
        expect(line).toBe(2);
    });

    it('handles patterns with Unicode characters', () => {
        const content = 'Testé\n日本語\nالعربية';
        const line = findLineNumber(content, /日本語/);
        expect(line).toBe(2);
    });
});

describe('MCP Unit: addLineInfo', () => {
    it('adds line info when line > 0', () => {
        const error = 'Something went wrong';
        const result = addLineInfo(error, 42);
        expect(result).toBe('Something went wrong\n   Line: 42');
    });

    it('returns original error when line = 0', () => {
        const error = 'Something went wrong';
        const result = addLineInfo(error, 0);
        expect(result).toBe('Something went wrong');
    });

    it('returns original error when line < 0', () => {
        const error = 'Something went wrong';
        const result = addLineInfo(error, -1);
        expect(result).toBe('Something went wrong');
    });

    it('handles multi-line error messages', () => {
        const error = 'Line 1\nLine 2\nLine 3';
        const result = addLineInfo(error, 10);
        expect(result).toBe('Line 1\nLine 2\nLine 3\n   Line: 10');
    });

    it('handles empty error message', () => {
        const error = '';
        const result = addLineInfo(error, 5);
        expect(result).toBe('\n   Line: 5');
    });
});
