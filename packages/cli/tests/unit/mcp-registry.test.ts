import { describe, it, expect } from 'vitest';
import { MCP_SERVERS, type McpServerConfig } from '../../dist/mcp-registry.js';

describe('MCP Registry', () => {
    describe('MCP_SERVERS array', () => {
        it('should contain at least one MCP server', () => {
            expect(MCP_SERVERS.length).toBeGreaterThan(0);
        });

        it('should have GitHub MCP server', () => {
            const github = MCP_SERVERS.find((s) => s.id === 'github');
            expect(github).toBeDefined();
            expect(github?.name).toBe('Official GitHub MCP');
        });

        it('should have Linear MCP server', () => {
            const linear = MCP_SERVERS.find((s) => s.id === 'linear');
            expect(linear).toBeDefined();
            expect(linear?.name).toBe('Linear MCP');
        });

        it('should have unique server IDs', () => {
            const ids = MCP_SERVERS.map((s) => s.id);
            const uniqueIds = new Set(ids);
            expect(ids.length).toBe(uniqueIds.size);
        });

        it('should have valid server entries with required fields', () => {
            MCP_SERVERS.forEach((server: McpServerConfig) => {
                expect(server.id).toBeDefined();
                expect(server.name).toBeDefined();
                expect(server.command).toBeDefined();
                expect(server.args).toBeInstanceOf(Array);
                expect(typeof server.requiresApiKey).toBe('boolean');
                expect(server.documentationUrl).toBeDefined();
            });
        });

        it('should have servers that require API keys', () => {
            const serversWithApiKey = MCP_SERVERS.filter((s) => s.requiresApiKey === true);
            expect(serversWithApiKey.length).toBeGreaterThan(0);

            serversWithApiKey.forEach((server: McpServerConfig) => {
                expect(server.documentationUrl).toBeDefined();
                expect(server.documentationUrl.length).toBeGreaterThan(0);
            });
        });

        it('should have servers without API key requirements', () => {
            const serversWithoutApiKey = MCP_SERVERS.filter((s) => s.requiresApiKey === false);
            expect(serversWithoutApiKey.length).toBeGreaterThan(0);
        });

        it('should have valid command and args for all servers', () => {
            MCP_SERVERS.forEach((server: McpServerConfig) => {
                expect(server.command).toBeTruthy();
                expect(server.command.length).toBeGreaterThan(0);
                expect(server.args).toBeInstanceOf(Array);
            });
        });

        it('should have valid documentation URLs', () => {
            MCP_SERVERS.forEach((server: McpServerConfig) => {
                expect(server.documentationUrl).toMatch(/^https?:\/\//);
            });
        });
    });

    describe('Server configuration structure', () => {
        it('should have GitHub server with correct config', () => {
            const github = MCP_SERVERS.find((s) => s.id === 'github') as McpServerConfig;
            expect(github).toBeDefined();
            expect(github.npmPackage).toBe('@github/mcp-server');
            expect(github.command).toBe('npx');
            expect(github.args).toEqual(['@github/mcp-server']);
            expect(github.requiresApiKey).toBe(true);
        });

        it('should have Linear server with correct config', () => {
            const linear = MCP_SERVERS.find((s) => s.id === 'linear') as McpServerConfig;
            expect(linear).toBeDefined();
            expect(linear.npmPackage).toBe('@linear/mcp-server');
            expect(linear.command).toBe('npx');
            expect(linear.args).toEqual(['@linear/mcp-server']);
            expect(linear.requiresApiKey).toBe(true);
        });

        it('should have Firebase server with correct config', () => {
            const firebase = MCP_SERVERS.find((s) => s.id === 'firebase') as McpServerConfig;
            expect(firebase).toBeDefined();
            expect(firebase.npmPackage).toBe('@firebase/mcp-server');
            expect(firebase.command).toBe('npx');
            expect(firebase.args).toEqual(['@firebase/mcp-server']);
            expect(firebase.requiresApiKey).toBe(false);
        });

        it('should have Playwright server with correct config', () => {
            const playwright = MCP_SERVERS.find((s) => s.id === 'playwright') as McpServerConfig;
            expect(playwright).toBeDefined();
            expect(playwright.npmPackage).toBe('@playwright/mcp');
            expect(playwright.command).toBe('npx');
            expect(playwright.args).toEqual(['@playwright/mcp']);
            expect(playwright.requiresApiKey).toBe(false);
        });
    });
});
