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
            thresholds: {
                statements: 70,
                branches: 65,
                functions: 75,
                lines: 70
            }
        },
        setupFiles: [],
        testTimeout: 30000,
        include: ['packages/*/tests/**/*.test.ts']
    },
    resolve: {
        alias: {
            '@spec-driven-steroids/test-utils': './packages/test-utils/src'
        }
    }
});
