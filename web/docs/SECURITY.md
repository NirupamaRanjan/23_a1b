# Security boundary - React frontend

This deliverable implements the client controls listed below. It does not include a FastAPI backend. The following server/deployment controls are mandatory integration and verification requirements; none requires a seventh screen. Client-side tests do not establish protection against all attacks.

## Request and data protection

- **CSRF:** For cookie-authenticated booking, status changes and summary refresh, validate a session-bound anti-CSRF token on every state-changing request; enforce allowed Origin/Referer or suitable Fetch Metadata policy. Use Secure/HttpOnly session cookies with an appropriate SameSite setting as defence in depth. Do not perform mutations via GET. CORS or SameSite alone is not a universal CSRF defence. Failed verification produces a friendly inline message, without sending or exposing a mutation result.
- **SQL injection:** Bind every ID, copay, date and search value as a parameter, including stored-procedure calls. Allowlist entity/table/sort names rather than interpolating client strings as identifiers. Use least-privilege database roles; invoking a stored procedure is not by itself proof of injection prevention.
- **Mongo/NoSQL injection:** Build filters and aggregation pipelines on the server from validated scalar inputs. Do not accept arbitrary operator objects, raw pipelines, $where, $function or untrusted query/regex expressions. Escape literal search strings and allowlist optional filters. Validate integer IDs, coordinates, dates and limits.
- **XSS:** Render patient/clinic names, tags, catalog keys/values, tooltips and errors as escaped text. Do not inject untrusted HTML, use dangerouslySetInnerHTML for database content, evaluate catalog text or allow javascript: links. If rich HTML is explicitly introduced later, use a maintained sanitiser and safe URL policy. Use CSP as defence in depth, not as a replacement for safe rendering.
- **Access control / IDOR:** Enforce patient and clinic permissions on the server for every record/request. A posted patient_id, selected clinic_id or browser role preference is not proof of permission. Staff can change only visits in their authorised scope. The assignment demo actor selector must stay confined to a controlled demo environment; it is not authentication. A real deployment must use a server-trusted identity/role mechanism. No login page is added to this design phase.
- **Money and consistency:** Validate copay > 0, at most two decimal places and the DECIMAL range. Recheck balance and clinic acceptance inside the transaction; preserve the partial unique index and status trigger. Use patient row locking, idempotent retries and expected-status concurrency checks. Never trust a UI-only disabled button to prevent repeat charges or unauthorised state transitions.
- **Privacy and transport:** Use HTTPS for application/API connections and provider-required database TLS. Keep database connection strings and secrets out of SVGs, browser code, logs, URLs and error responses. Request browser geolocation only after the user chooses Use my location; respect denial and provide manual origin entry. Consider map-provider exposure of viewed locations before deployment.
- **Abuse / resource limits:** Cap page size, date span, search length, result count and request frequency. Apply sensible API/database timeouts, rate limits, polling limits and cancellation on context changes. Preserve backend authorisation even when the same screen is open in multiple tabs.
- **Error handling and browser hardening:** Map expected procedure/index errors to clear messages. Do not return raw SQL, stack traces, credentials or patient details from another scope. Use narrowly scoped CORS, appropriate security headers and clickjacking protection. Reject malformed/extra input fields and unsafe URLs. Keep dependency/security updates and audit logging part of deployment.

## Verification before release

Test forged/missing CSRF tokens, cross-origin mutations, altered actor/clinic IDs, malicious search strings and Mongo operator payloads, stored/DOM XSS payloads in every displayed string, duplicate requests, concurrent bookings, stale status changes and forbidden audit edits. Run these checks in a disposable authorised environment. Display any validation/permission/network failure within its existing screen; never expose an extra administration or debugging screen.

## Primary guidance

- OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP SQL Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Cross Site Scripting Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

These references guide the later controls; reading them does not establish that the eventual application is secure against all attacks.

## Controls actually present in this React deliverable

- Normal React text rendering for names, tags and arbitrary catalog fields; no dangerouslySetInnerHTML/eval/user-supplied HTML or URL injection. Leaflet attribution is a fixed application string.
- Same-origin API URLs, same-origin credentials, no redirect following, request timeout/abort and safe code-to-message errors.
- In-memory CSRF token from the server session; client refuses POST/PATCH without it and attaches X-CSRF-Token. The server must validate it.
- Session-based `/me/audit`; no patient dropdown/client patient_id override. Server controls whether demo switching is available and which actors it permits.
- Positive decimal validation, disabled duplicate-submit controls and retained retry key/original clinic details after uncertain responses. Server locking, idempotency and balance/index checks are still necessary.
- No database connection strings or runtime fixture data in frontend source.

The paired FastAPI server implements sessions, Origin/CSRF verification, patient/clinic permissions, parameterized SQL, escaped Mongo search, persisted idempotency, concurrency checks and response limits. Nginx supplies deployment headers. Production identity integration is outside the local demo assignment. See docs/handover_note.md for tested cases.
