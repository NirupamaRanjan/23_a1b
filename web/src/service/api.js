const MESSAGES = {
    INSUFFICIENT_HSA_BALANCE:
        'Your HSA balance is too low for this copay. Enter a lower amount and try again.',
    ACTIVE_VISIT_EXISTS:
        'You already have an active visit. Clinic staff must discharge it before you can book again.',
    CLINIC_NOT_ACCEPTING: 'This clinic is not accepting patients. Choose another clinic in Browse.',
    INVALID_COPAY: 'Enter an amount greater than zero with no more than two decimal places.',
    STATUS_CONFLICT: 'This appointment changed elsewhere. Reload it before continuing.',
    INVALID_STATUS_TRANSITION: 'Visits move from Waiting to In consultation to Discharged.',
    CSRF_FAILED: 'Your request could not be verified. Refresh the session, then try again.',
    SESSION_EXPIRED: 'Your session is no longer available. Refresh the session to continue.',
    FORBIDDEN: 'You do not have permission to access this record or perform this action.',
    NOT_FOUND: 'This record is no longer available.',
    VALIDATION_ERROR: 'Check the highlighted fields and try again.',
    REFRESH_IN_PROGRESS: 'Another summary refresh is running. Try again shortly.',
    REQUEST_KEY_CONFLICT:
        'This retry belongs to different booking details. Check your appointments before starting a new booking.',
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
                    : 'Could not reach CareConnect. Please retry.',
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
}
export const API = new ApiClient();
