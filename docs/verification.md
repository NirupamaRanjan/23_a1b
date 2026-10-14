# Verification evidence

Verified against PostgreSQL **16.15**, MongoDB **7.0.16**, Python **3.12**, Node **24** and Chromium **153**. Tests used real disposable databases; frontend fixture tests are explicitly distinguished below.

| Check | Result |
|---|---|
| Inherited SQL 01–05 plus additive SQL 07 | Installed and executed successfully |
| Mongo validators/2dsphere/TTL/review/catalog indexes plus latest-ping index | Installed against real MongoDB |
| Original PostgreSQL seeder | 1,000 patients; 50 clinics; 50,000 appointments; 100,000 trigger-generated audit entries |
| Original Mongo seeder | 500,000 pings; 5,000 reviews; 40 flexible catalogs |
| Real PostgreSQL + MongoDB API integration | 18 passed |
| Seeded-data API smoke checks | All six screen endpoint groups returned successful real data |
| Frontend unit tests including session-startup regression | 16 passed |
| Frontend production build | Passed |
| Frontend browser scenarios using isolated contract fixtures | 14 passed |
| Live browser with real API and full inherited seeded data | Passed; six screens, actual booking/debit/trigger row, staff status progression and refresh |
| Compose configuration | YAML, dependencies, shared environment and build paths checked |
| Docker image/Compose runtime | Not executed here; local databases and actual API/Vite processes were used instead |

## Backend cases

Successful booking returns the exact procedure-created appointment and trigger-created audit entry. Duplicate active bookings and insufficient HSA roll back; balances and ledger counts are checked. UUID retry results persist and survive application restart; changed payloads with an existing key conflict. Concurrent identical retries charge once. Invalid decimal precision, zero/negative amounts, missing records and closed clinics are rejected.

Patient/clinic scopes, forged/missing CSRF, foreign Origin, rotated tokens and disabled production demo switching are checked. Status updates verify authorization, expected state, forward transitions and the ability to book after discharge. SQL audit immutability and status guards are exercised directly as well as through HTTP.

Date-filtered audit opening balances remain tied to the entire interval across pages; empty historical intervals use the initial balance. Literal wildcard/injection searches, page bounds and coordinate validation are checked. The RANGE average uses three actual revenue days in a seven-day interval, and tied clinics receive the same DENSE_RANK. Refresh records a durable timestamp; overlapping refreshes are rejected without changing it.

Real Mongo tests distinguish current active nurses from older nearby pings whose newer location is offline/outside the radius, exclude stale pings, preserve distance ordering, bound the limit and see a newly appended ping. Real $facet results handle empty reviews/missing buckets and flexible catalog serialization.

## Frontend and live integration

The fixture browser suite covers all routes on a phone, Reviews viewport behavior on five laptop/phone sizes, XSS text escaping, Browse-to-book handoff, session audit actor switching, friendly errors, validation, staff changes, refresh failure retention, uncertain booking retry, missing details and polling.

The live test never intercepts API requests. It books a real seeded patient visit, verifies the debit/audit response, changes its status through the real staff UI, refreshes the real view and opens Map/Reviews. It records a silent video in `docs/demo/`. A StrictMode startup session race discovered by this check was corrected in the API client and covered by a unit regression test.

Reproduce the live test on the local demo stack with `cd web && npm run test:live`. For manual development set `CARECONNECT_LIVE_URL=http://localhost:5173`. Start from seeded data with no active visit for the first patient; if a prior test was interrupted, discharge its waiting appointment in the staff UI before rerunning. The test deliberately leaves its debit/audit record intact and finishes by discharging the visit. Browser videos are generated under `web/test-results-live`, which is excluded from the submission; the reviewed demonstration copy is explicitly retained under `docs/demo`.

Original Part A source files were checked byte-for-byte against the inherited branch. The requested two-folder ZIP excludes dependencies, environments, caches, build outputs, Git internals and database dumps.
