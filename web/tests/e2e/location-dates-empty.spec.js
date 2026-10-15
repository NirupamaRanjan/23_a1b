import { test, expect } from '@playwright/test';
import { setupApi } from './fixtures';
const tiles = async (page) => page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
const defaultRange = () => {
    const end = new Date().toISOString().slice(0, 10);
    return { start: new Date(Date.parse(end) - 29*86400000).toISOString().slice(0, 10), end };
};
test('Map automatically uses real browser geolocation before searching', async ({ page }) => {
    const state = await setupApi(page); await tiles(page);
    await page.context().setGeolocation({ latitude: 17.385044, longitude: 78.486671, accuracy: 30 });
    await page.goto('/map');
    await expect(page.getByLabel('Origin latitude')).toHaveValue('17.385044');
    await expect(page.getByLabel('Origin longitude')).toHaveValue('78.486671');
    await expect(page.getByText(/reported accuracy: 30 m/)).toBeVisible();
    await expect.poll(() => state.calls.filter(x => x.path === '/nurses/nearby').at(-1)?.query.latitude).toBe('17.385044');
    expect(state.calls.filter(x => x.path === '/nurses/nearby').every(x => x.query.latitude === '17.385044')).toBe(true);
});
test('Denied location shows a clear state and manual coordinates still work', async ({ page }) => {
    const state = await setupApi(page); await tiles(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_, error) => error({ code: 1 }) } }));
    await page.goto('/map');
    await expect(page.getByRole('alert')).toContainText('permission was denied');
    expect(state.calls.filter(x => x.path === '/nurses/nearby')).toHaveLength(0);
    await page.getByLabel('Origin latitude').fill('17.445376'); await page.getByLabel('Origin longitude').fill('78.346144');
    await page.getByRole('button', { name: 'Apply origin' }).click();
    await expect(page.getByText('1. Nurse 42')).toBeVisible();
});
test('A late geolocation response cannot override a manually applied origin', async ({ page }) => {
    await setupApi(page); await tiles(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: success => { window.finishLocation = () => success({ coords: { latitude: 18.5, longitude: 73.85, accuracy: 20 } }); } } }));
    await page.goto('/map');
    await page.getByLabel('Origin latitude').fill('17.445376'); await page.getByLabel('Origin longitude').fill('78.346144');
    await page.getByRole('button', { name: 'Apply origin' }).click();
    await page.evaluate(() => window.finishLocation());
    await expect(page.getByLabel('Origin latitude')).toHaveValue('17.445376');
});
test('Location timeout remains recoverable using selected clinic', async ({ page }) => {
    await setupApi(page); await tiles(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_, error) => error({ code: 3 }) } }));
    await page.goto('/map'); await expect(page.getByRole('alert')).toContainText('timed out');
    await page.getByRole('button', { name: 'Use selected clinic' }).click();
    await expect(page.getByLabel('Origin latitude')).toHaveValue('17.445376');
});
test('Analytics initial populated dates exactly match the requested chart interval', async ({ page }) => {
    const state = await setupApi(page); await page.goto('/analytics'); const range = defaultRange();
    await expect(page.getByLabel('From (UTC)', { exact: true })).toHaveValue(range.start);
    await expect(page.getByLabel('To (UTC)', { exact: true })).toHaveValue(range.end);
    await expect.poll(() => state.calls.filter(x => x.path === '/analytics/revenue').at(-1)?.query.start_date).toBe(range.start);
    expect(state.calls.filter(x => x.path === '/analytics/revenue').every(x => x.query.start_date && x.query.end_date)).toBe(true);
    await page.getByLabel('From (UTC)', { exact: true }).fill('');
    await expect(page.getByRole('alert')).toContainText('Choose both dates');
    await expect(page.getByRole('img', { name: /Seven-day moving/ })).toHaveCount(0);
});
test('Audit restores applied dates across navigation, reload and patient switches', async ({ page }) => {
    const state = await setupApi(page); await page.goto('/audit'); const range = defaultRange();
    await expect(page.getByLabel('From date (UTC)')).toHaveValue(range.start);
    await expect(page.getByLabel('To date (UTC)')).toHaveValue(range.end);
    const from = '2026-09-01', to = '2026-09-10';
    await page.getByLabel('From date (UTC)').fill(from); await page.getByLabel('To date (UTC)').fill(to);
    await expect(page.getByText(/Date edits are not applied yet/)).toBeVisible();
    await page.getByRole('button', { name: 'Apply dates' }).click();
    await expect.poll(() => state.calls.filter(x => x.path === '/me/audit').at(-1)?.query.start_date).toBe(from);
    await page.getByRole('link', { name: 'Browse', exact: true }).click();
    await page.getByRole('link', { name: 'Audit trail', exact: true }).click();
    await expect(page.getByLabel('From date (UTC)')).toHaveValue(from);
    await page.reload(); await expect(page.getByLabel('To date (UTC)')).toHaveValue(to);
    await page.getByRole('button', { name: 'Choose demo actor' }).click();
    await page.getByRole('button', { name: 'Patient: Rohan Mehta', exact: true }).click();
    await expect(page.getByLabel('From date (UTC)')).toHaveValue(range.start);
    await page.getByRole('button', { name: 'Choose demo actor' }).click();
    await page.getByRole('button', { name: 'Patient: Asha Rao', exact: true }).click();
    await expect(page.getByLabel('From date (UTC)')).toHaveValue(from);
    await page.getByRole('button', { name: 'Last 30 days', exact: true }).click();
    await expect(page.getByLabel('From date (UTC)')).toHaveValue(range.start);
    expect(state.calls.filter(x => x.path === '/me/audit').every(x => x.query.start_date && x.query.end_date)).toBe(true);
});
test('Empty searches across six screens use the shared illustration and recovery actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const state = await setupApi(page); await tiles(page); state.nurseRows = [];
    const empty = { items: [], total: 0, pages: 0, page: 1, page_size: 5 };
    await page.route('**/api/v1/clinics?**', route => route.fulfill({ json: empty }));
    await page.goto('/browse'); await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    await page.goto('/transaction'); await expect(page.getByText('Your next step in care')).toBeVisible();
    await page.route('**/api/v1/me/audit?**', route => route.fulfill({ json: { ...empty, current_balance: '5000.00', opening_balance: '5000.00' } }));
    await page.goto('/audit'); await expect(page.getByText('No activity for these dates')).toBeVisible();
    await page.route('**/api/v1/analytics/revenue?**', route => route.fulfill({ json: { items: [], total_copay_revenue: '0.00' } }));
    await page.goto('/analytics'); await expect(page.getByText('No revenue for these dates')).toBeVisible();
    await page.goto('/map'); await expect(page.getByRole('button', { name: 'Refresh results' })).toBeVisible();
    if (process.env.CARECONNECT_QA_IMAGES) await page.screenshot({ path: `${process.env.CARECONNECT_QA_IMAGES}/map-empty.png`, fullPage: true });
    await page.route('**/api/v1/catalogs?**', route => route.fulfill({ json: empty }));
    await page.goto('/reviews');
    await expect(page.getByTestId('reviews-screen')).toBeVisible();
    if (await page.getByRole('tab', { name: 'Catalog', exact: true }).isVisible()) await page.getByRole('tab', { name: 'Catalog', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show all specialties' })).toBeVisible();
    await expect(page.getByTestId('empty-state').first().locator('svg')).toBeVisible();
});


test('Unsupported geolocation remains usable with manual or clinic selection', async ({ page }) => {
    await setupApi(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }));
    await page.goto('/map');
    await expect(page.getByRole('alert')).toContainText('location is unavailable');
    await expect(page.getByRole('button', { name: 'Use selected clinic' })).toBeEnabled();
});

test('Analytics permits historical dates beyond 30 days and labels the selected-period total', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/analytics');
    const date = days => new Date(Date.now()-days*86400000).toISOString().slice(0,10);
    const from = date(120), to = date(90);
    await page.getByLabel('From (UTC)', { exact: true }).fill(from);
    await page.getByLabel('To (UTC)', { exact: true }).fill(to);
    await expect(page.getByLabel('From (UTC)', { exact: true })).not.toHaveAttribute('min');
    await expect(page.getByRole('img', { name: /Seven-day moving/ })).toBeVisible();
    await expect(page.getByText('Selected-period copay revenue', { exact: true })).toBeVisible();
    await expect(page.getByText(`${from} to ${to} · discharged appointments`)).toBeVisible();
    await expect.poll(() => state.calls.filter(x => x.path === '/analytics/revenue').at(-1)?.query.end_date).toBe(to);
    expect(state.calls.filter(x => x.path === '/analytics/revenue').at(-1).query.start_date).toBe(from);
    await page.getByLabel('Ranking date (UTC)').fill(to);
    await expect(page.getByLabel('Ranking date (UTC)')).not.toHaveAttribute('min');
    await expect.poll(() => state.calls.filter(x => x.path === '/analytics/ranking').at(-1)?.query.date).toBe(to);
});
