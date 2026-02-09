import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        root: './',
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                '**/*.test.ts',
                '**/*.spec.ts',
                'dist/**',
                'tests/**'
            ],
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
        }
    },
    resolve: {
        alias: {
            '@test-utils': path.resolve(__dirname, '../test-utils/src'),
            '@mcp-dist': path.resolve(__dirname, './dist'),
            '-dist': path.resolve(__dirname, './dist')
        }
    }
});
