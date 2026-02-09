import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                '**/*.test.ts',
                '**/*.spec.ts',
                '**/dist/**',
                '**/fixtures/**',
                '**/types/**',
                '**/*.config.ts',
                'packages/test-utils/**'
            ],
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
        },
        setupFiles: [],
        testTimeout: 10000,
        include: ['**/__tests__/**/*.test.ts'],
        workspace: [
            'packages/cli',
            'packages/mcp',
            'packages/test-utils'
        ]
    },
    resolve: {
        alias: {
            '@spec-driven-steroids/test-utils': './packages/test-utils/src'
        }
    }
});
