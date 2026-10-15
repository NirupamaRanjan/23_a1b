import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ mode }) => {
    // Shared settings live at the repository root; keep legacy web/.env as a fallback.
    const env = {
        ...loadEnv(mode, process.cwd(), ''),
        ...loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), ''),
    };
    return {
        plugins: [react()],
        server: {
            host: '127.0.0.1',
            proxy: {
                '/api': {
                    target: env.CARECONNECT_API_PROXY || 'http://127.0.0.1:8000',
                    changeOrigin: false,
                },
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                        'ui-vendor': ['@mui/material', '@emotion/react', '@emotion/styled'],
                    },
                },
            },
        },
        test: {
            environment: 'jsdom',
            setupFiles: ['./tests/setup.js'],
            include: ['src/**/*.test.{js,jsx}'],
        },
    };
});
