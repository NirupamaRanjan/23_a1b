import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './api';
afterEach(() => vi.unstubAllGlobals());
describe('same-origin API boundary', () => {
    it('shares startup sessions and permits later refresh', async () => {
        let resolve;
        const fetch = vi.fn().mockImplementation(() => new Promise((done) => { resolve = done; }));
        vi.stubGlobal('fetch', fetch);
        const client = new ApiClient();
        const first = client.session();
        const second = client.session();
        expect(first).toBe(second);
        expect(fetch).toHaveBeenCalledTimes(1);
        resolve({ ok: true, json: async () => ({ csrf_token: 'one-session' }) });
        expect(await first).toEqual(await second);
        fetch.mockResolvedValue({ ok: true, json: async () => ({ csrf_token: 'refreshed' }) });
        expect(await client.session()).toEqual({ csrf_token: 'refreshed' });
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    it('blocks mutations without a CSRF token', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        await expect(
            new ApiClient().book({ clinic_id: 217, copay_amount: '500' }, 'key')
        ).rejects.toMatchObject({ code: 'CSRF_FAILED' });
        expect(fetch).not.toHaveBeenCalled();
    });
    it('sends CSRF and retry headers only on the same-origin mutation', async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ appointment: {} }) });
        vi.stubGlobal('fetch', fetch);
        const client = new ApiClient();
        client.setCsrfToken('session-token');
        await client.book({ clinic_id: 217, copay_amount: '500' }, 'retry-key');
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('/api/v1/appointments');
        expect(options.credentials).toBe('same-origin');
        expect(options.redirect).toBe('error');
        expect(options.headers['X-CSRF-Token']).toBe('session-token');
        expect(options.headers['Idempotency-Key']).toBe('retry-key');
        expect(options.body).not.toContain('patient_id');
    });
    it('does not expose raw server errors', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({
                    message: 'postgresql://private:password@server stack trace',
                }),
            })
        );
        await expect(new ApiClient().audit()).rejects.toMatchObject({
            message: 'The request could not be completed. Try again shortly.',
        });
    });
    it('explains a stopped API when the dev proxy answers without JSON', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 502,
                json: async () => {
                    throw new SyntaxError('Unexpected end of JSON input');
                },
            })
        );
        await expect(new ApiClient().audit()).rejects.toMatchObject({
            code: 'API_UNREACHABLE',
            message: expect.stringContaining('Could not reach the CareConnect API'),
        });
    });
});
