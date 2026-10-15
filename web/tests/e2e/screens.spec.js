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
            location: { type: 'Point', coordinates: [78.346144, 17.445376] },
            created_at: '2026-10-12T22:40:30Z',
            dist: { calculated: 200 },
        },
    ];
    await expect(page.getByText('1. Nurse 117')).toBeVisible({ timeout: 16000 });
    await expect(page).toHaveURL(/\/map$/);
});
test('Map lists a seeded nurse by name when the ping carries one', async ({ page }) => {
    const state = await setupApi(page);
    state.nurseRows = [
        {
            nurse_id: 42,
            nurse_name: 'Brian Osborne',
            is_active: true,
            location: { type: 'Point', coordinates: [78.346144, 17.445376] },
            created_at: '2026-10-12T22:40:30Z',
            dist: { calculated: 150 },
        },
    ];
    await page.goto('/map');
    await expect(page.getByText('1. Brian Osborne')).toBeVisible();
});
test('Analytics explains that only clinic staff can refresh the summary', async ({ page }) => {
    await setupApi(page);
    await page.goto('/analytics');
    await expect(page.getByRole('button', { name: 'Refresh summary' })).toBeDisabled();
    await expect(page.getByText('Switch to clinic staff in the header to refresh.')).toBeVisible();
});
test('A patient sees only their own record in Browse, without a search box', async ({ page }) => {
    await setupApi(page);
    await page.goto('/browse');
    await expect(page.getByLabel('Search clinics by name or ID')).toBeVisible();
    await page.getByRole('tab', { name: 'Patients' }).click();
    await expect(page.getByLabel('Search patients by name or ID')).toHaveCount(0);
});
test('The ranking date picker sits inside the Clinic ranking section', async ({ page }) => {
    await setupApi(page);
    await page.goto('/analytics');
    const title = await page.getByText('Clinic ranking', { exact: true }).boundingBox();
    const picker = await page.getByLabel('Ranking date (UTC)').boundingBox();
    const table = await page.getByRole('table', { name: 'Clinic ranking' }).boundingBox();
    expect(picker.y).toBeGreaterThan(title.y);
    expect(picker.y).toBeLessThan(table.y);
    await expect(page.getByText('Ranking date', { exact: true })).toHaveCount(0);
});

// Tile bytes are isolated in these behavior tests; they never depend on an external server.
const localTiles = async (page) => {
    await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
        contentType: 'image/gif',
        body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
    }));
};

test('Map keeps the same Leaflet instance on origin changes and clinic switches', async ({ page }) => {
    const state = await setupApi(page);
    await localTiles(page);
    await page.goto('/map');
    await expect(page.getByText('1. Nurse 42')).toBeVisible();
    const map = await page.locator('.leaflet-container').elementHandle();
    await page.getByLabel('Origin latitude').fill('17.446');
    await page.getByRole('button', { name: 'Apply origin', exact: true }).click();
    await expect(page.getByLabel('Origin latitude')).toHaveValue('17.446');
    expect(await map.evaluate((element) => element.isConnected)).toBe(true);
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Greenfield Medical (301)', exact: true }).click();
    await expect(page.getByLabel('Origin latitude')).toHaveValue('17.446');
    await page.getByRole('button', { name: 'Use selected clinic', exact: true }).click();
    await expect(page.getByLabel('Origin latitude')).toHaveValue('17.45');
    await expect(page.getByLabel('Origin longitude')).toHaveValue('78.35');
    expect(await map.evaluate((element) => element.isConnected)).toBe(true);
    await expect.poll(() => state.calls.filter((call) => call.path === '/nurses/nearby').at(-1)?.query.latitude).toBe('17.45');
});

test('Selecting a nurse marker does not move the search origin', async ({ page }) => {
    const state = await setupApi(page);
    state.nurseRows = [{ nurse_id: 42, is_active: true,
        location: { type: 'Point', coordinates: [78.347, 17.445376] },
        created_at: new Date().toISOString(), dist: { calculated: 430 } }];
    await localTiles(page);
    await page.goto('/map');
    await expect(page.getByText('1. Nurse 42')).toBeVisible();
    const before = await page.getByLabel('Origin longitude').inputValue();
    await page.locator('path.leaflet-interactive').nth(2).click();
    await expect(page.getByLabel('Origin longitude')).toHaveValue(before);
    await expect(page.getByRole('button', { name: 'Select Nurse 42', exact: true })).toHaveClass(/Mui-selected/);
});

test('Map refresh failure retains its previous results', async ({ page }) => {
    const state = await setupApi(page);
    await localTiles(page);
    await page.goto('/map');
    await expect(page.getByText('1. Nurse 42')).toBeVisible();
    state.nursesFailure = true;
    await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
    await expect(page.getByText(/Live update failed/)).toBeVisible();
    await expect(page.getByText('1. Nurse 42')).toBeVisible();
});

test('Staff with a retained audit patient cannot submit a booking', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/transaction');
    await page.getByRole('button', { name: 'Choose demo actor' }).click();
    await page.getByRole('button', { name: 'Clinic staff: Lakeview Family Clinic' }).click();
    await expect(page.getByRole('heading', { name: 'Clinic staff cannot book appointments' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Book appointment', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Copay amount')).toHaveCount(0);
    expect(state.calls.filter((call) => call.path === '/appointments' && call.method === 'POST')).toHaveLength(0);
});

test('Clinic staff see an access message instead of the audit trail', async ({ page }) => {
    const state = await setupApi(page);
    await page.goto('/audit');
    await expect(page.getByTestId('audit-patient')).toContainText('Asha Rao');
    await page.getByRole('button', { name: 'Choose demo actor' }).click();
    await page.getByRole('button', { name: 'Clinic staff: Lakeview Family Clinic' }).click();
    await expect(page.getByRole('heading', { name: 'Clinic staff cannot access the audit trail' })).toBeVisible();
    const before = state.calls.filter((call) => call.path === '/me/audit').length;
    await expect(page.getByTestId('audit-patient')).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'HSA audit entries' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Transaction', exact: true }).click();
    await page.getByRole('link', { name: 'Audit trail', exact: true }).click();
    expect(state.calls.filter((call) => call.path === '/me/audit').length).toBe(before);
    await page.getByRole('button', { name: 'Go to Browse' }).click();
    await expect(page).toHaveURL(/\/browse$/);
});

test('Analytics opens on the latest recorded data when the database is older than 30 days', async ({ page }) => {
    const state = await setupApi(page);
    state.latestRevenueDate = '2026-08-31';
    await page.goto('/analytics');
    await expect(page.getByTestId('analytics-latest-note')).toContainText('2026-08-31');
    await expect(page.getByLabel('From (UTC)', { exact: true })).toHaveValue('2026-08-02');
    await expect(page.getByLabel('To (UTC)', { exact: true })).toHaveValue('2026-08-31');
    await expect(page.getByLabel('Ranking date (UTC)')).toHaveValue('2026-08-31');
    await expect(page.getByLabel('Month (UTC)')).toHaveValue('2026-08');
    await expect.poll(() => state.calls.filter((x) => x.path === '/analytics/revenue').at(-1)?.query.end_date).toBe('2026-08-31');
    // No query is sent with the empty "today" defaults before the latest dates are known.
    expect(state.calls.filter((x) => x.path === '/analytics/ranking').every((x) => x.query.date === '2026-08-31')).toBe(true);
    await expect(page.getByRole('img', { name: /Seven-day moving/ })).toBeVisible();
});

test('Audit trail opens on the latest entries when the last 30 days are empty', async ({ page }) => {
    const state = await setupApi(page);
    state.latestAuditDate = '2026-08-20';
    await page.goto('/audit');
    await expect(page.getByLabel('From date (UTC)')).toHaveValue('2026-07-22');
    await expect(page.getByLabel('To date (UTC)')).toHaveValue('2026-08-20');
    await expect(page.getByText(/up to the latest entry on 2026-08-20/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'HSA audit entries' })).toBeVisible();
});

test('Changing catalog specialty resets pagination before fetching', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const state = await setupApi(page);
    await page.goto('/reviews');
    await expect(page.getByText('Paracetamol', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Catalog entry 2 of 40')).toBeVisible();
    await page.getByRole('button', { name: 'Cardiology', exact: true }).click();
    await expect(page.getByText('Cardiology reference', { exact: true })).toBeVisible();
    await expect(page.getByText('Catalog entry 1 of 2')).toBeVisible();
    expect(state.calls.filter((call) => call.path === '/catalogs' && call.query.specialty === 'Cardiology')
        .every((call) => call.query.page === '1')).toBe(true);
});


for (const width of [1440, 1920, 2560]) {
    test(`All six screens use the available desktop workspace at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1080 });
        await setupApi(page);
        await localTiles(page);
        for (const route of ['browse','transaction','audit','analytics','map','reviews']) {
            await page.goto('/' + route);
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
            const area = await page.getByRole('main').evaluate((element) => {
                const style = getComputedStyle(element);
                return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            });
            expect(area, `${route}: usable desktop content width`).toBeGreaterThanOrEqual(width - 50);
            const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
            expect(heading.x, `${route}: heading left gutter`).toBeCloseTo(24, 0);
            const panels = page.getByRole('main').locator('.MuiPaper-root');
            const bounds = await panels.evaluateAll((elements) => elements.map((element) => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right };
            }));
            expect(Math.min(...bounds.map((box) => box.left)), `${route}: panel left gutter`).toBeCloseTo(24, 0);
            expect(Math.max(...bounds.map((box) => box.right)), `${route}: panel right gutter`).toBeCloseTo(width - 24, 0);
            await page.evaluate(() => document.fonts.ready);
            expect(await page.evaluate(() => [...document.fonts].some((font) => font.family === 'Inter' && font.status === 'loaded'))).toBe(true);
            expect(await page.getByRole('heading', { level: 1 }).evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Inter');
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
            if (process.env.CARECONNECT_QA_IMAGES && width === 1920) {
                await page.screenshot({ path: `${process.env.CARECONNECT_QA_IMAGES}/${route}.png`, fullPage: true });
            }
        }
    });
}
