import { afterEach, expect, it, vi } from 'vitest';
import { last30Days, loadAuditRange, saveAuditRange, validRange, auditRangeKey } from './dateRange';
afterEach(() => { vi.useRealTimers(); sessionStorage.clear(); });
it('uses exactly 30 UTC calendar dates including today across a leap month', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2024-03-01T00:30:00Z'));
    expect(last30Days()).toEqual({ start_date: '2024-02-01', end_date: '2024-03-01' });
});
it('saves only valid applied ranges separately for each patient', () => {
    const a = { start_date: '2026-09-01', end_date: '2026-09-09' };
    const b = { start_date: '2026-10-01', end_date: '2026-10-05' };
    saveAuditRange(1, a); saveAuditRange(2, b);
    expect(loadAuditRange(1)).toEqual(a); expect(loadAuditRange(2)).toEqual(b);
    saveAuditRange(1, { start_date: '', end_date: '' });
    expect(loadAuditRange(1)).toEqual(a);
});
it('rejects invalid dates and recovers from corrupted saved data', () => {
    expect(validRange({ start_date: '2026-02-30', end_date: '2026-03-01' })).toBe(false);
    expect(validRange({ start_date: '2026-03-02', end_date: '2026-03-01' })).toBe(false);
    sessionStorage.setItem(auditRangeKey(1), 'corrupt');
    expect(loadAuditRange(1)).toEqual(last30Days());
});
