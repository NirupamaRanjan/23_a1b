const MESSAGES = {
    // Booking
    INSUFFICIENT_HSA_BALANCE:
        'Your HSA balance is too low for this copay. Enter a lower amount and try again.',
    ACTIVE_VISIT_EXISTS:
        'You already have an active visit. Clinic staff must discharge it before you can book again.',
    CLINIC_NOT_ACCEPTING: 'This clinic is not accepting patients. Choose another clinic in Browse.',
    CLINIC_NOT_FOUND: 'This clinic no longer exists. Choose another clinic in Browse.',
    INVALID_COPAY:
        'Enter a positive copay with no more than two decimal places (up to 99,999,999.99).',
    PATIENT_ONLY: 'Only patients can book. Switch to a patient in the header first.',
    REQUEST_KEY_CONFLICT:
        'This retry belongs to different booking details. Check your appointments before starting a new booking.',
    // Appointment status
    STATUS_CONFLICT: 'This appointment was updated elsewhere. Reload it before continuing.',
    INVALID_STATUS_TRANSITION: 'Visits move from Waiting to In consultation to Discharged.',
    STAFF_ONLY:
        'This action is for clinic staff. Switch to clinic staff in the header and try again.',
    OTHER_CLINIC:
        "Only staff of this appointment's clinic can change its status. Switch to that clinic in the header.",
    // Records, audit and analytics
    NOT_FOUND: 'This record is no longer available.',
    OWN_RECORD_ONLY: 'While acting as a patient you can only open your own patient record.',
    NO_PATIENT_SELECTED: 'Choose a patient in the header to see an audit trail.',
    INVALID_DATE_RANGE: 'The start date must be on or before the end date.',
    DATE_OUTSIDE_WINDOW:
        'Revenue analytics covers the last 30 days only. Choose dates in that range.',
    INVALID_MONTH: 'Choose a month to see its discharge summary.',
    REFRESH_IN_PROGRESS: 'Another summary refresh is running. Try again in a moment.',
    DOCUMENT_TOO_LARGE: 'This catalog document is too large to display.',
    VALIDATION_ERROR:
        'Some of the values sent were not valid. Check what you entered and try again.',
    // Session and security
    CSRF_FAILED: 'Your request could not be verified. Reload the page and try again.',
    SESSION_EXPIRED: 'Your demo session has expired. Reload the page to start a new one.',
    FORBIDDEN: 'You do not have permission to do this as the current actor.',
    DEMO_MODE_OFF: 'Switching actors is only available when the API runs in demo mode.',
    // Server and databases
    POSTGRES_UNAVAILABLE: 'PostgreSQL is not reachable. Check that it is running, then retry.',
    MONGO_UNAVAILABLE:
        'MongoDB (nurse, review and catalog data) is not reachable. Check that it is running, then retry.',
    DATABASE_TIMEOUT: 'The database took too long to answer. Please retry.',
    DATABASE_SETUP_INCOMPLETE:
        'The database is missing part of its setup. Run all SQL files, including sql/07_api_support.sql, then retry.',
    DATABASE_ERROR: 'The database rejected this request. Check the API log for details.',
    INTERNAL_ERROR: 'Something went wrong on the server. Check the API log, then retry.',
};
export class ApiError extends Error {
    constructor(message, status = 0, code = 'NETWORK_ERROR', uncertain = false) {
        super(message);
        this.status = status;
        this.code = code;
        this.uncertain = uncertain;
    }
}
export class ApiClient {
    constructor() {
        this.csrfToken = '';
    }
    setCsrfToken(token) {
        this.csrfToken = typeof token === 'string' ? token : '';
    }
    async request(path, { method = 'GET', params = {}, body, signal, requestKey } = {}) {
        const mutation = method !== 'GET';
        if (mutation && !this.csrfToken)
            throw new ApiError('Refresh your session before making changes.', 403, 'CSRF_FAILED');
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== '' && value !== undefined && value !== null)
                query.set(key, String(value));
        });
        const url = '/api/v1' + path + (query.size ? '?' + query.toString() : '');
        const controller = new AbortController();
        const cancel = () => controller.abort();
        signal?.addEventListener('abort', cancel, { once: true });
        if (signal?.aborted) controller.abort();
        const timeout = setTimeout(cancel, 20000);
        try {
            const result = await fetch(url, {
                method,
                signal: controller.signal,
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                headers: {
                    Accept: 'application/json',
                    ...(mutation
                        ? {
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': this.csrfToken,
                          }
                        : {}),
                    ...(requestKey ? { 'Idempotency-Key': requestKey } : {}),
                },
                ...(mutation ? { body: JSON.stringify(body || {}) } : {}),
            });
            let data;
            try {
                data = await result.json();
            } catch {
                throw new ApiError(
                    'The API returned an unexpected response. Check the backend connection.',
                    result.status,
                    'INVALID_RESPONSE',
                    mutation
                );
            }
            if (!result.ok) {
                const code =
                    typeof data.code === 'string'
                        ? data.code
                        : result.status === 401
                          ? 'SESSION_EXPIRED'
                          : result.status === 403
                            ? 'FORBIDDEN'
                            : result.status === 404
                              ? 'NOT_FOUND'
                              : 'REQUEST_FAILED';
                throw new ApiError(
                    MESSAGES[code] || 'The request could not be completed. Try again shortly.',
                    result.status,
                    code,
                    mutation && result.status >= 500
                );
            }
            return data;
        } catch (error) {
            if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
            if (error instanceof ApiError) throw error;
            throw new ApiError(
                mutation
                    ? 'Confirmation is uncertain. Keep the same details when retrying, and check your appointments before starting a different booking.'
                    : 'Could not reach the CareConnect API. Check that it is running, then retry.',
                0,
                'NETWORK_ERROR',
                mutation
            );
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', cancel);
        }
    }
    // Share startup requests so StrictMode cannot install mismatched session cookies.
    session = (options) => {
        if (options?.signal) return this.request('/session', options);
        if (!this.sessionRequest) {
            this.sessionRequest = this.request('/session', options).finally(() => {
                this.sessionRequest = null;
            });
        }
        return this.sessionRequest;
    };
    actors = (params, options) => this.request('/session/actors', { params, ...options });
    switchActor = (body) => this.request('/session/actor', { method: 'POST', body });
    browse = (entity, params, options) => {
        if (!['patients', 'clinics', 'appointments'].includes(entity))
            throw new Error('Invalid entity');
        return this.request('/' + entity, { params, ...options });
    };
    detail = (entity, id, options) =>
        this.request('/' + entity + '/' + encodeURIComponent(id), options);
    audit = (params, options) => this.request('/me/audit', { params, ...options });
    book = (body, requestKey) =>
        this.request('/appointments', { method: 'POST', body, requestKey });
    status = (id, body) =>
        this.request('/appointments/' + encodeURIComponent(id) + '/status', {
            method: 'PATCH',
            body,
        });
    revenue = (params, options) => this.request('/analytics/revenue', { params, ...options });
    ranking = (params, options) => this.request('/analytics/ranking', { params, ...options });
    monthly = (params, options) => this.request('/analytics/monthly', { params, ...options });
    refreshMonthly = () => this.request('/analytics/monthly/refresh', { method: 'POST' });
    nurses = (params, options) =>
        this.request('/nurses/nearby', {
            params: { ...params, limit: 10 },
            ...options,
        });
    reviews = (params, options) => this.request('/reviews/insights', { params, ...options });
    catalogs = (params, options) => this.request('/catalogs', { params, ...options });
    specialties = (params, options) =>
        this.request('/catalogs/specialties', { params, ...options });
}
export const API = new ApiClient();
