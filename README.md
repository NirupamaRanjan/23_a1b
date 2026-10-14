# CareConnect - On-Demand Telemedicine

A six-screen web application on top of the Assignment 1 CareConnect databases (Project 4).
PostgreSQL owns patients, clinics, appointments, HSA debits, the audit ledger, status rules, the
7-day moving-average analytics and the materialized view. MongoDB owns nurse telemetry (nearest
nurse within 5 km), patient-review facets and the flexible medical catalog. A FastAPI server (`api/`)
sits between the React frontend (`web/`) and both databases; the browser never talks to a database.

## Repository structure

```text
README.md              setup, assumptions, tech choices, demo, contribution table
.env.example           every setting in one place (copy to .env)
docker-compose.yml     one-command local stack
docs/                  handover_note.md, api_endpoints.md, design/, verification.md, demo/, ERD, Mongo schema map
sql/                   Part A DDL, indexes, triggers, procedure, materialized view, window query + 07_api_support.sql
mongo/                 collections, validators and indexes (01) + Part A workflow scripts (02, 03)
data_generation/       PostgreSQL and MongoDB seeders (Faker names)
performance/           Part A EXPLAIN / executionStats evidence
api/                   FastAPI server, bootstrap and fresh-ping scripts, integration tests
web/                   React + Material UI + Leaflet frontend, unit and browser tests
```

## The six screens

| Screen | Workflow | What it shows |
|---|---|---|
| Browse | - | Patients, clinics and appointments with server-side paging, search/filter and an inline detail view. Staff move appointments WAITING -> IN_CONSULTATION -> DISCHARGED from the detail view. |
| Transaction | Workflow 1 | Books an appointment through `sp_execute_appointment`, shows the HSA balance before/after and the new `wallet_audit_logs` row. Insufficient balance and a second active visit (partial unique index) show friendly messages. |
| Audit trail | - | Read-only `wallet_audit_logs` for the session patient with a date filter, opening balance and running balance. |
| Analytics | Workflow 2 + view | 7-day moving average chart (Part A window query), `DENSE_RANK()` ranking table, monthly discharges from the materialized view with "last refreshed" time and a refresh button (clinic staff). |
| Map | Workflow 3 | `$geoNear` results around a selectable origin, fixed 5 km radius, list sorted by distance, polling every 10 s. |
| Reviews | Workflow 4 | `$facet` rating distribution, top tags, overall average and the flexible `MedicalCatalogs` documents. |

Demo actors are switched from the header (patient or clinic staff); real login is not required.

## Setup (manual)

Requirements: Python 3.12+, Node 22.12+, PostgreSQL 16+, MongoDB 7+ with `mongosh`.
Run every command from the repository root unless stated otherwise.

### 1. Settings

```bash
cp .env.example .env          # then edit user, password and database names for your machine
set -a; source .env; set +a   # load the settings into this terminal (repeat in every new terminal)
```

The API finds the root `.env` by itself; `psql`, `mongosh` and the seeders read the loaded variables.
Do not create `api/.env` as well, and never commit `.env`.

### 2. Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r api/requirements.txt -r data_generation/requirements.txt
```

### 3. Databases

```bash
createdb "$PGDATABASE"                                                  # empty PostgreSQL database
mongosh "$CARECONNECT_MONGO_URI" mongo/01_collections_and_indexes.js   # validators + indexes
python api/scripts/bootstrap.py                                         # schema (sql/01-05, 07) + seed both stores
```

`bootstrap.py` installs `sql/01`-`05` and `sql/07_api_support.sql` on an empty database, seeds
**1,000 patients, 50 clinics, 50,000 appointments, 100,000 audit entries, 500 nurses, 500,000 nurse
pings, 5,000 reviews and 40 catalog documents**, and refreshes the materialized view. It only seeds
empty stores and is safe to run again. Seeding takes a few minutes.

To rebuild from scratch instead (these seeders **replace** existing data):

```bash
for f in sql/0[1-5]_*.sql sql/07_api_support.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
python data_generation/postgres_seeder.py
python data_generation/mongo_seeder.py
psql -c 'SELECT refresh_clinic_monthly_discharges();'
```

The Analytics "last refreshed" time is recorded only by the app's **Refresh summary** button (as clinic
staff), so click it once after a manual rebuild.

Part A workflows can still be run directly: `psql -f sql/06_window_analytics.sql`,
`mongosh "$CARECONNECT_MONGO_URI" mongo/02_workflow3_geonear.js`,
`mongosh "$CARECONNECT_MONGO_URI" mongo/03_workflow4_facet.js`, and
`psql -c 'CALL sp_execute_appointment(1, 1, 25.00);'`.

### 4. Run

```bash
# terminal 1 - API on http://127.0.0.1:8000 (docs: /api/docs, health: /api/health)
cd api && python main.py

# terminal 2 - frontend on http://localhost:5173
cd web && npm ci && npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the API with the original Origin header, so
cookies and CSRF stay on one origin (`CARECONNECT_API_PROXY` changes the target).

Nurse pings expire two hours after they are created (TTL index). The seeder spreads each nurse's
pings over the last 100 minutes, so the Map stays populated for about two hours after seeding. For a
live demo, run the telemetry simulator: it adds one current ping per nurse (a small move from the
last position, about 70% on duty) and new positions appear on the Map at its next poll.

```bash
python api/scripts/fresh_pings.py            # one round
python api/scripts/fresh_pings.py --loop 30  # a round every 30 seconds until Ctrl+C
```

## Setup (Docker)

```bash
docker compose up --build
```

Open **http://localhost:8080** (API on http://localhost:8000). The first start creates both databases,
validators and indexes and seeds everything; later starts keep the data (`docker compose down -v`
removes it). Live map telemetry: `docker compose exec api python scripts/fresh_pings.py --loop 30`.
Ports are bound to localhost and demo mode is enabled - keep this stack local.

## Demonstrating every workflow

1. **Browse** clinics, patients and appointments; search, page and open details.
2. Click **Book at this clinic** (filter clinics by "Accepting"), enter a copay and book. Transaction shows balance before/after and the
   trigger-generated audit row. Book again to show the partial-unique-index message; try a copay larger
   than the balance to show insufficient HSA.
3. **Audit trail** shows the session patient's ledger; filter by dates to see the opening and running balance.
4. In the header switch to **clinic staff** for the booked clinic. In Browse -> Appointments move the visit
   WAITING -> IN_CONSULTATION -> DISCHARGED, then switch back and book again.
5. **Analytics**: pick a clinic and dates for the moving average, a date for the ranking, and (as staff)
   refresh the monthly summary to update "last refreshed".
6. **Map**: choose an origin (clinic, coordinates, your location or a map click); results update every 10 s.
   Run `python api/scripts/fresh_pings.py --loop 30` meanwhile to watch nurses move.
7. **Reviews**: rating distribution, top tags, average rating and one catalog document per page.

## Assumptions

- PostgreSQL and MongoDB run locally on their default ports.
- Appointment statuses are `WAITING`, `IN_CONSULTATION`, `DISCHARGED` and only move forward (trigger in
  `sql/03`). Only `DISCHARGED` appointments count as revenue and monthly discharges.
- Workflow 2 reports the most recent 30 days with a 7-calendar-day `RANGE` window; days without revenue
  are excluded, not zero-filled. Monthly counts use the creation month in UTC.
- Money is exact decimal account units (no currency in the schema); copays with more than two decimals are
  rejected.
- GeoJSON coordinates are `[longitude, latitude]`; distances are metres. Pings expire two hours after
  `created_at`. The map shows each nurse's latest active location, not an older nearer ping.
- `wallet_audit_logs` is append-only. The seeder spreads the trigger-generated audit timestamps over the
  seeded 60 days (in id order) so the date filter is meaningful; running balances are unchanged.
- Reviews have no clinic id, so their charts are global. `patient_id` in reviews refers to PostgreSQL
  `patients.id`. Nurse names and home areas live in the `Nurses` collection; every nurse works around one
  clinic, so each clinic and any origin inside the service area has nurses within 5 km. Origins far
  outside the area correctly show "No active nurses within 5 km".
- About 20% of clinics (10 of 50) are seeded as not accepting patients; clinic 1, the default clinic of
  a new session, always accepts. Booking at a non-accepting clinic is rejected by the procedure.
- The Audit trail lists the newest entries first; the opening balance is the balance before the
  earliest entry in the selected period.
- Sessions, CSRF tokens, booking idempotency keys and the view's last-refresh time are stored by the API in
  `sql/07_api_support.sql`; Part A tables, triggers and the procedure are unchanged by it.
- Demo mode (actor switching) is enabled in `.env.example` and Compose; it defaults to off in code.

## Tech choices

- **React + Material UI + Leaflet** (existing frontend): colours centralised in `web/src/colors.js`.
- **FastAPI** for typed validation and generated API docs; **psycopg2** and **PyMongo** match the seeders.
- Server-side sessions (HttpOnly, SameSite=Strict cookies), CSRF + Origin checks on every mutation,
  parameterised SQL and escaped Mongo search.
- **Docker Compose** makes both stores reproducible for a new person.

## Code notes

**API (`api/`)**
- `app/main.py` routes and error mapping; `app/services.py` PostgreSQL work (browse, booking via
  `sp_execute_appointment`, status changes, audit, analytics - the Workflow 2 query is read from
  `sql/06_window_analytics.sql`); `app/mongo_services.py` `$geoNear`, `$facet` and catalog paging;
  `app/security.py` server sessions, CSRF and Origin checks; `app/config.py` settings from the root `.env`.
- `scripts/bootstrap.py` installs `sql/01`-`05` and `07` on an empty database and seeds empty stores;
  `scripts/fresh_pings.py [--loop N]` is the nurse-telemetry simulator (demo mode only).
- Run on its own: `cd api && python main.py` (docs at http://127.0.0.1:8000/api/docs).

**Frontend (`web/`)**
- All colours live in `web/src/colors.js`; changing `COLORS.primary` restyles buttons, navigation,
  charts and accents. Styling is inside the `.jsx` components (MUI `styled`, `sx`, `GlobalStyles`);
  there are no CSS files.
- Feature folders under `web/src/component/` hold the six screens; API calls are in
  `web/src/service/api.js`, which also maps every API error code to a readable message.
- Reviews fits the browser window without a page scrollbar; on phones and short windows its
  Overview / Charts / Catalog parts become tabs, and long catalog entries scroll inside their panel.
- React renders database text as plain text (no injected HTML), keeps the CSRF token in memory and
  sends it only on same-origin requests. Server-side protections are listed under Assumptions.

## Tests

```bash
# frontend unit and browser tests (browser tests use test-only API fixtures)
cd web && npm test && npm run build && npx playwright install chromium && npm run test:e2e

# API integration tests against disposable databases (the PostgreSQL name must end in _test)
createdb careconnect_test
cd api && pip install -r requirements-dev.txt && pytest tests -q
```

The API tests read `CARECONNECT_TEST_DATABASE_URL` and `CARECONNECT_TEST_MONGO_URI` (in `.env.example`) and
cover the procedure's success and rollback, audit rows, copay precision, authorization, CSRF, retries,
concurrency, status transitions, RANGE/DENSE_RANK, refresh conflicts, search, paging and nearest-nurse
semantics. `cd web && npm run test:live` checks the running stack end to end. Details: `docs/verification.md`.

## Submission metadata

- Inherited repository URL: https://github.com/NirupamaRanjan/23_a1b/tree/a2-fixes
- Inherited source commit: `22efe1638f8e2c53314a95d36b9424d7944f3740`
- **Final team repository URL:** fill after pushing.
- **Final submission commit:** fill with the pushed revision.
- **Demo video (<= 5 min):** [docs/demo/careconnect-live-demo.webm](docs/demo/careconnect-live-demo.webm) - replace with your team's recording link.
- **Screenshots:** add them to `docs/screenshots/` and link them here.

| Team member | Design contribution | Code/test contribution |
|---|---|---|
| Member 1 | Fill honestly | Fill honestly |
| Member 2 | Fill honestly | Fill honestly |
| Member 3 | Fill honestly | Fill honestly |
| Member 4 | Fill honestly | Fill honestly |

More detail: `docs/handover_note.md` (changes to Part A), `docs/api_endpoints.md` (API),
`web/docs/API_CONTRACT.md` and `web/docs/SECURITY.md` (frontend contract and security notes),
`docs/design/` (wireframes and users), `docs/submission_checklist.md`.

## Assignment 1 evidence

### Stress-test results

The clean-install seeders were executed successfully in disposable databases on 3 September 2026:

| Store | Generated data | Verified count |
|---|---:|---:|
| PostgreSQL `appointments` | 50,000 | 50,000 |
| PostgreSQL `wallet_audit_logs` | 100,000 trigger-generated rows | 100,000 |
| MongoDB `NursePings` | 500,000 | 500,000 before TTL expiry |
| MongoDB `PatientReviews` | 5,000 | 5,000 |

### Performance proof

Raw output is committed in `performance/postgres_explain_analyzes.txt` and `performance/mongo_execution_stats.json`. Key excerpts are pasted here as required by the assignment.

PostgreSQL Workflow 2 (`EXPLAIN (ANALYZE, BUFFERS)` on 50,000 appointments):

```text
Index Only Scan using idx_appointments_discharged_analytics on appointments
  Index Cond: (created_at >= (CURRENT_DATE - '30 days'::interval))
  Heap Fetches: 0
  Index Searches: 1
Execution Time: 24.751 ms
```
MongoDB Workflow 3 (`explain("executionStats")` on 500,000 nurse pings):

```text
inputStage: GEO_NEAR_2DSPHERE
indexName: location_2dsphere
totalKeysExamined: 14009
totalDocsExamined: 22912
final nReturned: 1
maxDistance: 5000
```

MongoDB Workflow 4 (`explain("executionStats")` on 5,000 reviews):

```text
stage: IXSCAN
indexName: rating_1
totalKeysExamined: 5000
totalDocsExamined: 5000
```

Tested with PostgreSQL 18.6, MongoDB 7.0.40, and Python 3.14.4.


### AI Tool Usage Disclosure
In the completion of this lab activity, generative AI was utilized as a learning assistant and pair-programming tool for the following tasks:
*   Understanding and breaking down the problem statements and grading rubric.
*   Reviewing and refining the code for accuracy, edge-case handling, and best practices.
*   Explaining specific parts of the code that I failed to fully understand after refinement
*   Optimizing the code for performance across the large dataset.
*   Creating and formatting this `readme.md` file based on the finalized coding process.