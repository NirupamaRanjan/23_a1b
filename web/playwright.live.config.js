import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/live',
    outputDir: './test-results-live',
    workers: 1,
    timeout: 90000,
    use: {
        baseURL: process.env.CARECONNECT_LIVE_URL || 'http://localhost:8080',
        viewport: { width: 1366, height: 900 },
        video: { mode: 'on', size: { width: 1366, height: 900 } },
        launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH ? {
            executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
        } : {},
    },
    reporter: [['list']],
});
