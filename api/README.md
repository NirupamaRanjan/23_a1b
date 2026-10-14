# CareConnect — six screens with PostgreSQL + MongoDB

This is the backend integrated with your existing six-screen React frontend. PostgreSQL owns booking, HSA debits, audit logging, status rules, moving-average analytics and the materialized view. MongoDB owns nearby-nurse search, review facets and medical catalogs. API responses match `web/docs/API_CONTRACT.md`.

## Quick start with Docker

Install Docker Desktop/Engine with Compose v2. From the extracted ZIP:

```bash
cd api
docker compose up --build
```

Open **http://localhost:8080**. The first start installs the inherited schema and Mongo validators/indexes, then seeds **1,000 patients, 50 clinics, 50,000 appointments, 100,000 audit entries, 500,000 nurse pings, 5,000 reviews and 40 catalogs**. Allow a few minutes for image downloads and seeding. Subsequent starts preserve the data. API documentation: http://localhost:8000/api/docs. Health: http://localhost:8000/api/health.

The stack binds published ports to localhost and explicitly enables assignment demo mode. Keep it local. `docker compose down` preserves named data volumes. For local demo passwords the default is `postgres`; set `POSTGRES_PASSWORD` consistently when creating fresh volumes. Existing database volumes retain their original password.

## Manual development

Requirements: Python 3.12+, Node 22+, PostgreSQL 16+ and MongoDB 7+ with mongosh. Create an empty PostgreSQL database named `careconnect`; your configured PostgreSQL role must be able to create the schema. Start MongoDB locally.

```bash
cd api
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell instead: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# PowerShell instead: Copy-Item .env.example .env
```

Edit `.env` with your database URL and Mongo URI. On Linux/macOS run:

```bash
mongosh mongodb://localhost:27017/ mongo/01_collections_and_indexes.js
mongosh mongodb://localhost:27017/ mongo/04_api_indexes.js
python scripts/bootstrap.py
python main.py
```

If using a different Mongo database name, set `CARECONNECT_MONGO_DB` in the shell for mongosh as well as in `.env`. In a second terminal:

```bash
cd web
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to http://localhost:8000 with the original Origin header, so cookies and CSRF stay on the same browser origin. `web/vite.config.js` supports `CARECONNECT_API_PROXY` for a different API address. Do not open `index.html` directly or use Vite's preview server without an API reverse proxy. The provided Docker web image serves the built frontend through Nginx with that proxy and security headers.

## Demonstrate all workflows

1. Browse clinics/patients/appointments, search, page and open inline details. A patient sees their own patient record and visits; clinic staff see visits belonging to their clinic.
2. Book at a clinic from Browse. Transaction shows the selected clinic, HSA balance before/after and the actual trigger-generated debit. Book again while active to show the partial-index failure. Test a copay larger than the balance to show insufficient HSA.
3. Open Audit trail. It uses the server patient context, inclusive UTC date filtering, a whole-period opening balance, per-entry running balances and the full filtered count.
4. Switch to staff for the booking's clinic using the header. In Browse, move WAITING → IN_CONSULTATION → DISCHARGED. Then switch back to the patient and book again. Staff IDs represent clinic IDs in this demo.
5. Analytics shows the assigned 7-day recorded-day average and DENSE_RANK. Pick a date containing revenue; today's ranking can honestly be empty with randomly generated historical data. Staff can refresh the materialized monthly discharge summary and see a durable successful timestamp.
6. Map searches a selectable origin with a fixed 5 km radius and polls while visible. Pings expire after two hours. To append new current telemetry, run `docker compose exec api python scripts/fresh_pings.py` (or `python scripts/fresh_pings.py` locally). The map finds the latest active location of each nurse, not an old nearer ping.
7. Reviews shows the global $facet distribution, top tags, average rating and paged flexible medical documents. There is no clinic_id guarantee in inherited reviews, so selecting a clinic does not falsely scope these charts.

For a browser check against the running real stack, use `cd web && npm run test:live`. Set `CARECONNECT_LIVE_URL=http://localhost:5173` for manual development; the default is the Compose URL. This books and discharges a real demo visit and keeps its audit trail.

## Structure and choices

The requested ZIP has exactly `web/` and `api/` at its root. Assignment 1 folders are retained under `api/`: `sql/`, `mongo/`, `data_generation/`, `performance/`, and `docs/`. Handover: `docs/handover_note.md`; endpoint sketch/contract: `docs/api_endpoints.md`; wireframes and users: `docs/design/`; test evidence: `docs/verification.md`.

React, Material UI and Leaflet are retained from the existing frontend, including centralized colors and JSX styling. FastAPI provides typed validation and generated API docs; small classes separate database adapters from HTTP handlers. Like the spotify2MP3 reference, the Python code uses clear named functions, environment configuration, a small entry point, descriptive comments and straightforward control flow. We use FastAPI rather than its Flask framework because the agreed frontend contract specifies FastAPI. psycopg2 and PyMongo fit the inherited seeders and keep the API simple. Docker Compose makes the two stores reproducible.

## Database changes and assumptions

- Existing SQL 01–06, Mongo 01–03 and original seeders are preserved. API additions are SQL 07 and Mongo 04. Details are in the handover note.
- Money is exact decimal account units serialized as strings; the schema defines no currency. Reject copays with more than two fractional digits rather than silently round them in HTTP.
- Appointment statuses are executable DDL literals: WAITING, IN_CONSULTATION, DISCHARGED. Only discharged visits count as revenue/discharges.
- The 30-day analytics source and RANGE window are unchanged. Missing revenue days are excluded, not zero-filled; displayed date bounds apply after calculating the window. Requested dates must be in the current source interval. Monthly counts use creation month in UTC because that is what the inherited view defines.
- Server sessions derive the booking patient and audit context; patient IDs in booking payloads are rejected. Local demo mode permits all seeded actors. Staff status updates are restricted to their clinic. Staff audit context is the explicitly retained previous demo patient.
- Booking UUID idempotency keys and their results persist atomically with the procedure transaction. Retries after connection loss or API restart return the original response; a reused key with changed details returns 409. Results are retained without expiry so old ambiguous retries do not double-debit.
- Refresh and its timestamp commit together; a database advisory lock prevents simultaneous API refreshes. An externally executed manual refresh cannot supply metadata and should be avoided while demonstrating timestamp accuracy.
- Bootstrap only seeds empty stores. Do not run the original destructive seeders on a working dataset. Bootstrap is intended for one setup process; the Compose dependency ensures only one initializer.
- Demo mode defaults **off** in application settings and is explicitly enabled in `.env.example` and local Compose. With it disabled and no trusted authentication adapter installed, the API does not create sessions or grant staff from browser input. Real login is not required by the assignment.
- Server-managed opaque cookies are HttpOnly and SameSite Strict. All mutations check the session CSRF token and allowlisted Origin. SQL values are parameterized; Mongo search is escaped; JSX escapes flexible document text. Nginx supplies CSP; Emotion/MUI needs inline styles. HTTPS deployments must set secure cookies and their exact allowed origins.

## Tests

Frontend:

```bash
cd web
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

API integration tests intentionally require real disposable stores and reset their data. Create `careconnect_test` using your local PostgreSQL administrator. Install dev requirements, then:

```bash
cd api
pip install -r requirements-dev.txt
export CARECONNECT_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/careconnect_test
export CARECONNECT_TEST_MONGO_URI=mongodb://localhost:27017/
pytest tests -q
```

PowerShell uses `$env:CARECONNECT_TEST_DATABASE_URL='...'` and `$env:CARECONNECT_TEST_MONGO_URI='...'` instead of export. Only a PostgreSQL database ending in `_test` is accepted; Mongo uses `careconnect_test`. Without the test URL, tests are skipped explicitly. Test schema setup retains ledger guards; only the privileged reset fixture temporarily disables them. Tests cover procedure success/rollback, actual audit rows, precision validation, authorization, CSRF, persistent retries, concurrency, status transitions, RANGE/DENSE_RANK, refresh conflicts, literal searches, pagination and current nurse semantics.

## Submission metadata — complete with your team's real details

- Inherited repository URL: https://github.com/NirupamaRanjan/23_a1b/tree/a2-fixes
- Inherited source commit: `22efe1638f8e2c53314a95d36b9424d7944f3740`
- **Final team repository URL:** fill after pushing into the assigned fork.
- **Final submission commit:** fill with that pushed revision; it is not the inherited hash above.
- **Included demo:** [silent live walkthrough](docs/demo/careconnect-live-demo.webm), recorded against the full seeded PostgreSQL/MongoDB stack. Upload it to your team's sharing service and add that URL if Moodle requires an external link.
- **New Assignment 2 team number:** fill before renaming the ZIP to `<new_team_number>_a1b.zip`.

| Team member | Design contribution | Code/test contribution |
|---|---|---|
| Actual member 1 | Fill honestly | Fill honestly |
| Actual member 2 | Fill honestly | Fill honestly |
| Actual member 3 | Fill honestly | Fill honestly |
| Actual member 4 | Fill honestly | Fill honestly |

Keep Assignment 1 history in your fork. This ZIP excludes Git internals, environments, dependency folders, caches, build output and database dumps. Review `docs/submission_checklist.md` before Moodle submission. AI-assisted implementation and testing should be disclosed according to your course policy, consistent with the inherited repository's disclosure.
