import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/e2e',
    workers: 1,
    timeout: 45000,
    use: {
        baseURL: 'http://localhost:5186',
        trace: 'retain-on-failure',
        launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH
            ? {
                  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
                  args: [
                      '--no-sandbox',
                      '--disable-dev-shm-usage',
                      '--use-gl=angle',
                      '--use-angle=swiftshader',
                  ],
              }
            : {},
    },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5186 --strictPort',
        url: 'http://localhost:5186',
        reuseExistingServer: !process.env.CI,
    },
    reporter: [['list']],
});
