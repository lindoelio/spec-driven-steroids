import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        root: './',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                '**/*.test.ts',
                '**/*.spec.ts',
                'dist/**',
                'fixtures/**'
            ],
            statements: 60,
            branches: 60,
            functions: 60,
            lines: 60
        }
    }
});
