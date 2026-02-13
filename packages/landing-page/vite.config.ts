
import { defineConfig } from 'vite'

export default defineConfig({
    base: '/spec-driven-steroids/', // Repository name for GitHub Pages
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    }
})
