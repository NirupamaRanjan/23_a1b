# Verification evidence

Verified against PostgreSQL **16.15**, MongoDB **7.0.16**, Python **3.12**, Node **22.14.0** (unit/build) and **24** (browser orchestration) and Chromium **153**. Tests used real disposable databases; frontend fixture tests are explicitly distinguished below.

| Check | Result |
|---|---|
| Inherited SQL 01–05 plus additive SQL 07 | Installed and executed successfully |
| Mongo validators/2dsphere/TTL/review/catalog indexes plus latest-ping index | Installed against real MongoDB |
| Original PostgreSQL seeder | 1,000 patients; 50 clinics; 50,000 appointments; 100,000 trigger-generated audit entries |
| Original Mongo seeder | 500,000 pings; 5,000 reviews; 40 flexible catalogs |
| Backend integration + configuration tests | 30 passed |
| Seeded-data API smoke checks | All six screen endpoint groups returned successful real data |
| Frontend unit tests including session-startup regression | 16 passed |
| Frontend production build | Passed |
| Frontend browser scenarios using isolated contract fixtures | 26 passed |
| Live browser with real API and full inherited seeded data | Passed; six screens, actual booking/debit/trigger row, staff status progression and refresh |
| Compose configuration | Actual Compose CLI validation passed; ports, health checks, dependencies and build paths checked |
| Docker image/Compose runtime | Not executed here; local databases and actual API/Vite processes were used instead |

## Layout and font follow-up

This follow-up changes presentation only; the backend, database scripts, Windows launchers and
Docker configuration are preserved from the documented release.

- 26 browser scenarios passed on Chromium 153 with API contract fixtures, including all six screens
  at 1440, 1920 and 2560 px. Actual outer panel edges and headings are 24 px from the viewport sides.
- Browser checks confirmed the local Inter font loaded and the headings use it. Mobile overflow
  checks and Reviews layouts at 320–1440 px passed. Wide-screen screenshots were inspected internally.
- The final production build and all 16 unit tests passed on Node 22.14.0.
- The production font file matches the bundled 48,256-byte source asset. The font is preloaded
  locally with `font-display: swap`; its SIL Open Font License is included.
- Live database tests and native Windows/Docker execution were not repeated for this visual update.
  Earlier database results above are from the prior release, not new runs.

## Chart readability follow-up

The shared Reviews rating/tag chart renderer now uses larger text/bars and fills the plot height.
Ten relevant browser scenarios passed: five Reviews viewport sizes, all six routes on a phone,
catalog pagination, and all six routes at 1440/1920/2560 px. The final production build and 16
unit tests passed on Node 22.14.0. Desktop chart layout was visually inspected. API/database tests
were not repeated for this presentation-only change.

## Root database setup, medical_db and catalog update

Current release verification used disposable PostgreSQL 16 and MongoDB 7.0.16 instances.
The application database was `medical_db`; tests alone used isolated `medical_db_test`.

- Root `mongo/setup.py` applied and checked all four collection validators/indexes.
- Root `data_generation/bootstrap.py` seeded 50,000 appointments, 500 nurses, 500,000 pings,
  5,000 reviews and 40 catalog entries. Running bootstrap again and invoking the normal Mongo
  seeder preserved populated records. Fresh-ping generation added current telemetry.
- All 30 backend/configuration tests passed, including schema idempotence/data preservation,
  validator rejection, required database naming, missing location-index repair, multiple geo-index
  selection, and command-error classification. Existing booking/audit/security tests also passed.
- With approximately 501,000 pings, the map API returned 10 nearby nurses in 3.238 s in the seeded
  area. The supplied Hyderabad coordinates returned HTTP 200 with an empty list in 0.003 s.
  These are local measurements, not performance guarantees or assertions about the user's database.
- The real browser booking/debit/audit/consultation/discharge/refresh workflow passed through
  the live API and databases. The six screens also loaded in that workflow.
- All 26 isolated browser scenarios passed after the catalog typography and spacing update.
  Catalog headings, fields, availability rows and internal scrolling were visually inspected.
- All 16 frontend unit tests and the production build passed on Node 22.14.0.
- Docker Compose v5.6 configuration parsing passed after removing the separate mongo-init service;
  source inspection confirmed the API image includes root mongo/schema tooling. PowerShell script
  parsing passed in PowerShell 7 on Linux.
- Native Windows, Docker image/engine execution and native mongosh execution were not run here.
  Optional JavaScript installers were syntax checked; the actual schema install was exercised
  through Python/PyMongo. Platform CI remains available for host-specific execution.

The user's original OperationFailure could not be reproduced from that exception class alone.
The corrected setup repairs missing required indexes and returns specific command error categories;
remaining failures now log the MongoDB numeric server code instead of hiding the cause.
See `database_setup.md` for the exact upgrade commands and database-name requirement.

## Backend cases

Successful booking returns the exact procedure-created appointment and trigger-created audit entry. Duplicate active bookings and insufficient HSA roll back; balances and ledger counts are checked. UUID retry results persist and survive application restart; changed payloads with an existing key conflict. Concurrent identical retries charge once. Invalid decimal precision, zero/negative amounts, missing records and closed clinics are rejected.

Patient/clinic scopes, forged/missing CSRF, foreign Origin, rotated tokens and disabled production demo switching are checked. Status updates verify authorization, expected state, forward transitions and the ability to book after discharge. SQL audit immutability and status guards are exercised directly as well as through HTTP.

Date-filtered audit opening balances remain tied to the entire interval across pages; empty historical intervals use the initial balance. Literal wildcard/injection searches, page bounds and coordinate validation are checked. The RANGE average uses three actual revenue days in a seven-day interval, and tied clinics receive the same DENSE_RANK. Refresh records a durable timestamp; overlapping refreshes are rejected without changing it.

Real Mongo tests distinguish current active nurses from older nearby pings whose newer location is offline/outside the radius, exclude stale pings, preserve distance ordering, bound the limit and see a newly appended ping. Real $facet results handle empty reviews/missing buckets and flexible catalog serialization.

## Frontend and live integration

The fixture browser suite covers all routes on a phone, Reviews viewport behavior on five laptop/phone sizes, XSS text escaping, Browse-to-book handoff, session audit actor switching, friendly errors, validation, staff changes, refresh failure retention, uncertain booking retry, missing details and polling.

The live test never intercepts API requests. It books a real seeded patient visit, verifies the debit/audit response, changes its status through the real staff UI, refreshes the real view and opens Map/Reviews. It records a silent video under `web/test-results-live/`; the earlier retained demo in `docs/demo/` is historical. A StrictMode startup session race discovered by this check was corrected in the API client and covered by a unit regression test.

Reproduce the live test on the local demo stack with `cd web && npm run test:live`. For manual development set `CARECONNECT_LIVE_URL=http://localhost:5173`. Start from seeded data with no active visit for the first patient; if a prior test was interrupted, discharge its waiting appointment in the staff UI before rerunning. The test deliberately leaves its debit/audit record intact and finishes by discharging the visit. Browser videos are generated under `web/test-results-live`, which is excluded from the submission; the reviewed demonstration copy is explicitly retained under `docs/demo`.

This review starts from the uploaded updated project and preserves its assignment root folders (`sql/`, `mongo/`, `data_generation/`, `docs/`, `performance/`) alongside `api/` and `web/`. The corrected ZIP excludes dependencies, private environments, caches, build outputs, Git internals and database dumps. See `review_fixes.md` and `performance/review_map_timing.json` for the current review; earlier Part A evidence remains historical.

Latest layout and platform support: `layout_platform_update.md`. Native Windows/Docker CI jobs are provided but were not run from this session.
