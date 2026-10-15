import { todayUTC } from './format';

// Thirty calendar dates, including today; all API date boundaries are UTC.
export const last30Days = () => {
    const end_date = todayUTC();
    const start_date = new Date(Date.parse(end_date) - 29 * 86400000).toISOString().slice(0, 10);
    return { start_date, end_date };
};

export const validDate = (value) => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;

export const validRange = (range) => validDate(range?.start_date) &&
    validDate(range?.end_date) && range.start_date <= range.end_date;

export const auditRangeKey = (patientId) => `careconnect:audit-range:v1:${patientId}`;
export const loadAuditRange = (patientId) => {
    try {
        const range = JSON.parse(sessionStorage.getItem(auditRangeKey(patientId)));
        if (validRange(range)) return range;
    } catch { /* Unavailable storage or stale values must not prevent loading the ledger. */ }
    return last30Days();
};
export const saveAuditRange = (patientId, range) => {
    if (!patientId || !validRange(range)) return;
    try { sessionStorage.setItem(auditRangeKey(patientId), JSON.stringify(range)); }
    catch { /* The current screen still works when storage is unavailable. */ }
};
