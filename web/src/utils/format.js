export const validId = (value) =>
    Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
export const parseCopay = (value) => {
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) return null;
    const [whole, fraction = ''] = String(value).split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents > 0 && cents <= 9999999999 ? cents : null;
};
export const centsOf = (value) => {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
};
export const money = (value) => {
    const cents = centsOf(value);
    return cents === null
        ? '—'
        : new Intl.NumberFormat('en', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          }).format(cents / 100);
};
export const dateTime = (value) => {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'UTC',
          }).format(date)
        : '—';
};
export const todayUTC = () => new Date().toISOString().slice(0, 10);
export const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
export const shortId = (value) => String(value || '—');
