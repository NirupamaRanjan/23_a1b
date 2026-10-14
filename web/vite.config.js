import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        server: {
            host: '127.0.0.1',
            proxy: {
                '/api': {
                    target: env.CARECONNECT_API_PROXY || 'http://localhost:8000',
                    changeOrigin: false,
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
