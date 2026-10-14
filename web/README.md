# CareConnect - six React screens

React + JavaScript implementation of the approved teal design with exactly six screens. The implemented FastAPI backend is in `../api/`; start the complete project from `../api/README.md`. The browser never connects directly to either database.

## Run

Requires Node 22.12+ (or Node 24).

```bash
npm ci
npm run dev
```

Open http://localhost:5173. Start your FastAPI API on port 8000, or copy `.env.example` to `.env` and change the `CARECONNECT_API_PROXY` development proxy target. The browser always calls same-origin `/api/v1` URLs. Do not put PostgreSQL/MongoDB connection strings in the frontend.

The paired backend implements `docs/API_CONTRACT.md`. The frontend shares its initial session request to keep cookies and CSRF tokens synchronized in React StrictMode. There are no runtime mocks.

## The six screens

| Route | Behaviour |
|---|---|
| `/browse` | Patients/Clinics/Appointments tabs, bounded server pages, search/filter and inline details. **Book at this clinic navigates to `/transaction` and carries the selected clinic.** Staff status controls stay inside appointment details. |
| `/transaction` | Positive decimal copay, current/before/after balance, exact returned trigger audit, friendly failures, duplicate-submit lock and retry key. The backend derives the patient from its session. |
| `/audit` | Patient name/ID are plain text from the server session, not a patient dropdown. The third summary card is **Number of entries**, reflecting the filtered total. Dates, read-only rows, stored running balances and paging are retained. |
| `/analytics` | Assigned seven-day average, date-specific DENSE_RANK table, monthly discharge summary and last successful refresh time. Failed refresh retains the prior summary. |
| `/map` | Real Leaflet map, selectable origin, 5 km radius, ordered active nurses and ten-second polling without reload. Initial clinic coordinates come from the API. |
| `/reviews` | Overall average/count, rating/tag charts and flexible catalog. Fits the browser viewport without a body scrollbar. Catalog content remains in a sized keyboard-focusable panel. |

There are no separate dashboard, detail, catalog, actor-picker, login or More routes. Root/unknown URLs redirect to Browse. Demo actor selection is a header popover, enabled only when the server session explicitly says `demo_mode: true`; it is not authentication.

## Styling

- **All application colours are in `src/colors.js`.** Change `COLORS.primary` once to update primary buttons, navigation, chart bars, accents and derived pale backgrounds. Semantic error/success and text/surface colours are also centralised there.
- Styling is inside `.jsx` components using MUI `styled`, `sx` and `GlobalStyles`. There are no standalone CSS files or CSS imports, including for Leaflet. Theme creation/global rules are in `src/App.jsx`.
- Material UI icons are used through `@mui/icons-material`.
- Components, API calls, session context and hooks are separated into readable feature folders. API errors use a safe message registry, not raw database errors.

## Reviews viewport behaviour

On normal desktop viewports, the summary, both charts and catalog share the viewport. On phones or windows <=740px high, Overview/Charts/Catalog are sections within the SAME Reviews route, allowing each section to fit. Long catalog documents and expanded extra fields scroll inside the document panel; the browser page itself does not scroll. Content is not hidden merely to suppress a scrollbar. There is no practical way to show an arbitrarily large Mongo document simultaneously on a small screen; the internal panel and per-document pagination preserve access to all fields.

The available catalog height, visible medication content and absence of body overflow are browser-tested at 1440x900, 1366x768, 1024x660, 390x844 and 320x568. Other pages stack naturally on phones; navigation scrolls horizontally within its own bar, without a seventh More screen.

## Database alignment

Reference: https://github.com/NirupamaRanjan/23_a1b/tree/a2-fixes, reviewed commit `22efe1638f8e2c53314a95d36b9424d7944f3740`.

The code expects integer SERIAL IDs; positive DECIMAL(10,2) copays; WAITING/IN_CONSULTATION/DISCHARGED; TIMESTAMPTZ dates; Mongo `is_active`, `nurse_id`, GeoJSON `[longitude, latitude]`, `bedside_manner_tags`, and flexible `MedicalCatalogs`. No currency was specified, so money uses account units.

The materialized view has discharge counts, not a revenue column. Revenue is separately query-derived. The backend must track a durable last-successful-refresh timestamp and return the precise booking audit row. The supplied geoNear script keeps the nearest active historical ping; implementing the accepted latest-ping semantics requires a documented backend correction. Those backend gaps are described in the API contract; this frontend does not silently modify the schema.

## Security boundary

The client escapes database strings through normal React text rendering, never injects untrusted HTML, keeps CSRF tokens in memory, refuses mutation requests without a token, sends the token on same-origin mutations, avoids frontend database credentials, and uses safe error messages. It also validates form values and keeps original clinic/amount details when retrying an uncertain booking. Session identity is obtained from the API, not trusted from localStorage.

**No React-only implementation can guarantee prevention of all security attacks.** The API must validate CSRF, enforce server-session record permissions, parameterise SQL, construct allowed Mongo filters, apply database constraints/locks and implement durable idempotency. See `docs/SECURITY.md`; these server protections are required but are not implemented by this frontend deliverable.

## Tests

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start Vite and intercept the documented API with **test-only** fixtures in `tests/e2e/fixtures.js`. They verify frontend behaviour, not a deployed API/database or a comprehensive penetration test. Application source never imports these fixtures and has no fake-data fallback. No seed scripts, dummy-data folder, database dumps, node_modules or build output are delivered.

See `docs/VERIFICATION.md` for the performed checks and scope.

## Full-stack demo and checks

The paired API implements the complete database contract. Use `npm run test:live` against the running local Compose stack (or set CARECONNECT_LIVE_URL for Vite). The reviewed recording and full test evidence are in `../api/docs/`.
