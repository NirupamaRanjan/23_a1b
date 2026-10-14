const fallback = new Map();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only random retry keys and hashed fingerprints are persisted, never session/CSRF tokens.
export const bookingKey = async (fingerprint) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    const name =
        'careconnect.booking.' +
        Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    let key;
    try {
        key = sessionStorage.getItem(name);
    } catch {
        key = fallback.get(name);
    }
    if (!key || !UUID.test(key)) {
        key = crypto.randomUUID();
        fallback.set(name, key);
        try {
            sessionStorage.setItem(name, key);
        } catch {
            /* private storage disabled; in-memory retry still works */
        }
    }
    return { key, name };
};
export const clearBookingKey = (attempt) => {
    if (!attempt) return;
    fallback.delete(attempt.name);
    try {
        sessionStorage.removeItem(attempt.name);
    } catch {
        /* storage disabled */
    }
};
