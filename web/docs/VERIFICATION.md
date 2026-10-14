# Verification - six React screens

Checked on 12 October 2026.

| Check | Result | Scope |
|---|---|---|
| Production build (`npm run build`) | Passed | Vite compiled all six lazy-loaded screens. |
| Unit/component tests (`npm test`) | 15 passed | Decimal and ID validation, CSRF request guard/headers, safe error messages, escaped catalog text and flexible/null availability data. |
| Browser suite (`npm run test:e2e`) | 14 passed | Browse-to-booking clinic transfer, booking/audit result, session-dependent audit name/count, friendly failures, staff status, retained summary after failed refresh, uncertain retry idempotency, record error handling, live nurse polling, phone layouts and Reviews viewport checks. |
| Reviews tests repeated after final layout changes | 5 passed | 1440x900, 1366x768, 1024x660, 390x844 and 320x568. Visible medication content and non-collapsed catalog panel are checked alongside no browser page overflow. |
| Visual review | Completed | Browse, Audit, Map and desktop/phone Reviews were inspected with synthetic test responses. The catalog layout was corrected after visual review exposed a collapsed panel. |

The browser tests intercept the API using fixtures under `tests/e2e`. They do not connect to PostgreSQL, MongoDB or a deployed FastAPI server. Fixtures are never imported by the application. This is frontend behaviour verification, not database integration testing or a penetration test.

The shipped source has exactly six named screen routes, no standalone CSS files, no runtime dummy-data folder and no database connection strings. All application colour literals are in `src/colors.js`; styling remains in JSX. Internal detail panels, popovers and Reviews section tabs do not add routes or screens.

Required integration work remains in `API_CONTRACT.md` and `SECURITY.md`: implement the session API, server-side permissions and CSRF verification, parameterised SQL/allowed Mongo queries, durable idempotency and refresh metadata. Re-run the browser suite and server/database security and concurrency tests against that implementation before release.

Development-only npm environment and React Router future-version warnings were non-fatal. No test establishes that every possible security attack is prevented.
