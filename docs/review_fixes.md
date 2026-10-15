# Review of the updated CareConnect project

This review uses the uploaded `careconnect.zip` as the source of truth. It retains the six updated
screens, JSX styling, centralized colours, Faker names, specialty chips, review summaries, newest-first
audit, analytics layout and nurse telemetry simulator. It does not reset your existing databases.

## Confirmed problems and changes

| Area | Verified problem | Correction |
|---|---|---|
| Frontend installation | The uploaded package and lock files still selected Vite 8/Rolldown and jsdom 30, despite the earlier Windows workarounds. Several dependencies required a newer Node than 22.14. | Pin Vite 6.4.4, React plugin 4.7.0, jsdom 26.1.0 and Vitest 4.1.11. Use React Router 7.18.4 for patched compatible routing. Regenerate the lock. Unit tests and build pass on Node 22.14.0. |
| Map reuse | Changing the origin changed the MapContainer key, destroyed Leaflet and rebuilt its tile layer. | Preserve the Leaflet instance and move its view through `useMap().setView()`. |
| Map clicks | Required interactive SVG pointer-event CSS was missing. Nurse clicks could also bubble into the origin picker. | Restore marker pointer events, prevent decorative tiles intercepting clicks, and disable nurse-marker event bubbling. Add accessible nurse-selection labels. |
| Selected clinic | Changing the clinic after Map mounted did not update the origin. | Synchronize the selected clinic coordinates without remounting the map. |
| Polling | Manual refresh discarded successful nurse results; context changes could expose old results briefly. | Retain successful data on refresh failures, hide other-origin/actor results, abort obsolete requests and poll visibly without overlapping requests. |
| Tile failures | Image downloads and nurse-query loading were indistinguishable to the user. | Show a separate tile-loading message and a tile-error retry button. Nurse results remain independent. |
| Styling/build | A duplicate Leaflet control CSS key overwrote right alignment; the main bundle was oversized. | Combine the control styles and split shared React/UI vendor chunks. |
| Reviews | Specialty changes could fetch the new specialty at the old page before a separate effect reset pagination. | Change specialty and page together; keep exact backend filtering. |
| Booking | Staff retaining an audit patient could attempt booking through the UI even though the API rejects it. | Disable staff submission and explain switching to a patient. |
| API organization | Router files duplicated endpoints in `app/main.py` and were unused; their settings dependency was not initialized. | Register the routers as the single endpoint definitions and initialize settings/services during lifespan. Include the updated specialties and exact-filter endpoints. |
| Validation/errors | Nonpositive/oversized path IDs and the maximum end date could reach database/overflow errors. Mongo timeout and lock timeout errors lacked the correct response classification. | Bound IDs, reject the overflowing date and return consistent timeout errors. Discard broken PostgreSQL pool connections. |
| Settings | The API, bootstrap and telemetry script looked for `.env` in different places; the root template was missing. | Prefer the shared root `.env`, with legacy `api/.env` fallback. Vite reads the root proxy setting with legacy `web/.env` fallback. Exported settings take priority. |
| Existing data | Checking only the patients table could allow demo seeding over a partially populated relational store. | Require all four relational tables to be empty; require the nurse directory and other Mongo collections to be empty before demo seeding. |
| Manual Mongo setup | Bootstrap did not guarantee the indexes used by the latest-ping query. | Idempotently ensure geo, TTL, latest-ping, review, catalog and nurse-directory indexes during bootstrap and telemetry startup. The root Mongo init script already had the latest-ping index. |
| Docker | `api/docker-compose.yml` conflicted with the assignment root structure and build paths. | Keep the repository-root Compose file as the single supported stack. |
| Seed timestamps | PostgreSQL seed timestamps were based on naive local times despite UTC analytics. | Generate timezone-aware UTC timestamps. Reject telemetry loop intervals below five seconds. |

## Why the map can be slow

There are two independent requests:

1. Leaflet downloads background images from `tile.openstreetmap.org`. Network latency, blocked requests,
   or the provider can delay those images. The old remount behavior also recreated tiles unnecessarily.
   This release preserves the map instance, loads tiles when movement settles and shows image failures.
   It does not bypass provider caching rules or bulk-download maps.
2. `/api/v1/nurses/nearby` queries the two-hour `NursePings` history. With 500,000 pings, finding each
   nurse's latest valid active location requires real work even though only ten nurses are returned.
   Three local API calls took approximately **2.3–2.5 seconds**, excluding map images. Raw timings and
   counts are in `performance/review_map_timing.json`. This is a measurement, not a guarantee for your PC.

The API preserves latest-ping correctness: a newer offline or out-of-radius ping prevents an older,
nearby ping being shown. It does not incorrectly apply the limit before verifying each nurse's latest
state. Manual bootstrap now ensures the supporting indexes and the pipeline carries only needed fields.

To identify a remaining delay on your PC, open the browser's Developer Tools → Network and compare
`nurses/nearby` with `tile.openstreetmap.org` requests. A slow nurse request points to database work;
slow/failed tile images point to the image connection. An empty nurse list after two hours is expected
TTL expiry, not slow Leaflet. Run `python data_generation/fresh_pings.py --loop 30` for a live demo.

## Install this correction safely

Extract to a new folder. Keep your existing `.env` privately, preferably at the root; legacy `api/.env`
continues to work if no root file exists. The ZIP deliberately excludes your credentials, `node_modules`,
virtual environments, Git internals, caches and generated test output. The root `.env.example` is a
sanitized template, not your active settings. See the Windows PowerShell section in `README.md`.

Use `npm.cmd ci` in `web` with the included lock. Do not copy old dependencies or retain the WASI
workaround. Run `data_generation/bootstrap.py` to add API support/indexes to an already initialized Part A
store; it does not recreate populated demo data. On a fresh store, follow the root README for database
creation and Mongo validators. Existing four tables alone do not replace SQL 02–05's indexes, triggers,
procedure and materialized view.

## Verification and limits

- 23 API integration cases passed against real PostgreSQL 16.15 and MongoDB 7.0.16.
- 16 frontend unit tests and a production build passed on Node 22.14.0 (also checked on Node 24).
- 23 browser scenarios passed on Chromium 153, including five map/booking/catalog regression scenarios.
- A live browser workflow passed against the real seeded API: booking, trigger debit/audit, staff status
  transitions, analytics refresh and all six screens.
- `npm audit` reported zero known vulnerabilities at the time of review.
- Docker configuration/build paths were inspected; Docker images were not executed here.
- Tests ran on Linux. Windows native execution and your own network/database settings still require a
  local check. No testing can guarantee the absence of every possible error.

The earlier PDF/changelog and Part A performance evidence are retained as historical project documents.
This review and the current source describe the corrected release.
