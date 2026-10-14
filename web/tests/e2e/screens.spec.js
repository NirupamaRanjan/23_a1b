import { test, expect } from '@playwright/test';
import { setupApi } from './fixtures';
test('Browse book button opens Transaction with the chosen clinic', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/browse');
    await page.getByRole('button', { name: 'View details: Greenfield Medical' }).click();
    await page.getByRole('button', { name: 'Book at this clinic' }).click();
    await expect(page).toHaveURL(/\/transaction$/);
    await expect(page.getByLabel('Clinic', { exact: true })).toHaveValue(
        'Greenfield Medical · 301'
    );
    await page.getByLabel('Copay amount').fill('500.00');
    await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Appointment booked' })).toBeVisible();
    await expect(page.getByText('90418', { exact: true })).toBeVisible();
    const booking = state.calls.find(
        (row) => row.path === '/appointments' && row.method === 'POST'
    );
    expect(booking.body).toEqual({ clinic_id: 301, copay_amount: '500.00' });
    expect(booking.headers['x-csrf-token']).toBe('test-session-csrf');
    expect(booking.headers['idempotency-key']).toBeTruthy();
});
test('Audit patient is session-bound, and its third card shows entry count', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/audit');
    await expect(page.getByTestId('audit-patient')).toContainText('Asha Rao');
    await expect(page.getByText('Number of entries')).toBeVisible();
    await expect(page.getByText('Ledger access', { exact: false })).toHaveCount(0);
    await expect(page.getByTestId('audit-patient').getByRole('combobox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose demo actor' }).click();
    await page.getByRole('button', { name: 'Patient: Rohan Mehta', exact: true }).click();
    await expect(page.getByTestId('audit-patient')).toContainText('Rohan Mehta');
    expect(
        state.calls
            .filter((row) => row.path === '/me/audit')
            .every((row) => !('patient_id' in row.query))
    ).toBe(true);
});
test('Friendly stored-procedure errors stay on Transaction', async ({ page }) => {
    const state = await setupApi(page);
    state.bookFailure = 'ACTIVE_VISIT_EXISTS';
    await page.goto('/transaction');
    await page.getByLabel('Copay amount').fill('500.00');
    await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('already have an active visit');
    await expect(page).toHaveURL(/\/transaction$/);
    expect(state.session.patient.hsa_balance).toBe('5000.00');
});
test('Zero and overly precise copays never create a booking', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/transaction');
    for (const value of ['0', '0.001']) {
        await page.getByLabel('Copay amount').fill(value);
        await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('positive copay');
    }
    expect(
        state.calls.filter((row) => row.path === '/appointments' && row.method === 'POST')
    ).toHaveLength(0);
});
test('Staff can change status inside Browse; refresh failure retains summary', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/browse');
    await page.getByRole('button', { name: 'Choose demo actor' }).click();
    await page.getByRole('button', { name: 'Clinic staff: Lakeview Family Clinic' }).click();
    await page.getByRole('tab', { name: 'Appointments', exact: true }).click();
    await page.getByRole('button', { name: 'View details: Rohan Mehta' }).click();
    await page.getByRole('button', { name: 'Start consultation' }).click();
    await expect(page.getByRole('button', { name: 'Discharge appointment' })).toBeVisible();
    state.refreshFailure = true;
    await page.getByRole('link', { name: 'Analytics', exact: true }).click();
    await expect(page.getByText('214', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh summary' }).click();
    await expect(page.getByRole('alert')).toContainText('previous summary');
    await expect(page.getByText('214', { exact: true })).toBeVisible();
});
for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1024, 660],
    [390, 844],
    [320, 568],
]) {
    test(`Reviews has no browser scrollbar at ${width}x${height}`, async ({ page }) => {
        await setupApi(page);
        await page.setViewportSize({ width, height });
        await page.goto('/reviews');
        await expect(page.getByTestId('reviews-screen')).toBeVisible();
        await expect(page.getByText('4.20', { exact: false })).toBeVisible();
        expect(
            await page.evaluate(() => ({
                horizontal: document.documentElement.scrollWidth > innerWidth + 1,
                vertical: document.documentElement.scrollHeight > innerHeight + 1,
            }))
        ).toEqual({ horizontal: false, vertical: false });
        if (width < 600 || height <= 740) {
            await page.getByRole('tab', { name: 'Catalog', exact: true }).click();
        }
        await expect(page.getByTestId('catalog-content')).toContainText('Paracetamol');
        await expect(page.getByText('Paracetamol', { exact: true })).toBeVisible();
        expect(
            await page.getByTestId('catalog-content').evaluate((element) => element.clientHeight)
        ).toBeGreaterThan(110);
        await expect(page.getByTestId('catalog-content').locator('img')).toHaveCount(0);
        expect(await page.evaluate(() => window.__xss)).toBeUndefined();
        expect(
            await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)
        ).toBe(true);
    });
}
test('All six screens load without browser runtime errors or page overflow on phone', async ({
    page,
}) => {
    await setupApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const path of ['/browse', '/transaction', '/audit', '/analytics', '/map', '/reviews']) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            path
        ).toBe(true);
    }
    expect(errors).toEqual([]);
});

test('An uncertain booking retries with the same key and does not double-debit', async ({
    page,
}) => {
    const state = await setupApi(page);
    state.dropBookingResponse = true;
    await page.goto('/transaction');
    await page.getByLabel('Copay amount').fill('500.00');
    await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('uncertain');
    await expect(page.getByLabel('Copay amount')).toBeDisabled();
    await page.getByRole('button', { name: 'Retry the same booking', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Appointment booked' })).toBeVisible();
    const calls = state.calls.filter(
        (row) => row.path === '/appointments' && row.method === 'POST'
    );
    expect(calls).toHaveLength(2);
    expect(calls[0].headers['idempotency-key']).toBe(calls[1].headers['idempotency-key']);
    expect(state.session.patient.hsa_balance).toBe('4500.00');
});
test('A missing record shows its error instead of an endless detail spinner', async ({ page }) => {
    await setupApi(page);
    await page.route('**/api/v1/clinics/217', (route) =>
        route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'NOT_FOUND' }),
        })
    );
    await page.goto('/browse');
    await page.getByRole('button', { name: 'View details: Lakeview Family Clinic' }).click();
    await expect(page.getByRole('alert')).toContainText('no longer available');
    await expect(page.getByRole('button', { name: 'Book at this clinic' })).toHaveCount(0);
});
test('A new nurse ping appears after polling without navigation', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/map');
    await expect(page.getByText('1. Nurse 42')).toBeVisible();
    state.nurseRows = [
        {
            nurse_id: 117,
            is_active: true,
            location: { type: 'Point', coordinates: [-73.98513, 40.748817] },
            created_at: '2026-10-12T22:40:30Z',
            dist: { calculated: 200 },
        },
    ];
    await expect(page.getByText('1. Nurse 117')).toBeVisible({ timeout: 16000 });
    await expect(page).toHaveURL(/\/map$/);
});
