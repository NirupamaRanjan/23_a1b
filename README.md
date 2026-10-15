# CareConnect - On-Demand Telemedicine

A six-screen web application on top of the Assignment 1 CareConnect databases (Project 4).
PostgreSQL owns patients, clinics, appointments, HSA debits, the audit ledger, status rules, the
7-day moving-average analytics and the materialized view. MongoDB owns nurse telemetry (nearest
nurse within 5 km), patient-review facets and the flexible medical catalog. A FastAPI server (`api/`)
sits between the React frontend (`web/`) and both databases; the browser never talks to a database.

Handover and verification notes: [docs/handover_note.md](docs/handover_note.md).

## MongoDB database and setup (current release)

**The application uses the MongoDB database `medical_db`.** Within it, `Nurses`, `NursePings`,
`PatientReviews` and `MedicalCatalogs` are separate collections. This does not rename PostgreSQL.
Edit your existing active root `.env` (or legacy `api/.env`) to set:

```dotenv
CARECONNECT_MONGO_URI=mongodb://localhost:27017/
CARECONNECT_MONGO_DB=medical_db
```

Retain your actual URI/credentials if different. A conflicting exported `CARECONNECT_MONGO_DB`
takes precedence over `.env`; remove it in PowerShell with
`Remove-Item Env:CARECONNECT_MONGO_DB -ErrorAction SilentlyContinue` before launching again.
Other runtime MongoDB database names are rejected with an explicit configuration error.
No existing database is renamed, copied or deleted automatically. If your records currently live
in a different database, import the desired records into `medical_db` before normal use.

With the Python environment ready, run from the project root:

```powershell
python mongo/setup.py                 # repairs schema/index setup; preserves documents
python mongo/setup.py --check         # read-only schema/index check
python data_generation/bootstrap.py   # SQL setup + Mongo setup; seeds only empty stores
```

`mongo/schema.json` is the only definition of collections, validators and indexes. Both the Python
setup and optional `mongo/01_collections_and_indexes.js` read it. The old `api/app/mongo_setup.py`
has been removed. `api/scripts/` contains compatibility launchers only; implementations live in
`data_generation/`. Normal API requests never create collections or indexes.

A seeded database is demo data. Running `data_generation/mongo_seeder.py` preserves populated
stores unless you explicitly pass `--reset-data`. Nurse pings expire after two hours; to simulate
fresh pings from the existing nurse directory, run `python data_generation/fresh_pings.py --loop 30`.

Map operation failures now identify missing schema/indexes, permissions, authentication and
unsupported queries separately. Logs include the MongoDB numeric error code, without returning
raw server details to the browser. An `OperationFailure` alone did not establish the original
cause. Run root setup and retry; if it still fails, retain the new server code for diagnosis.

## Repository structure

```text
README.md              setup, assumptions, tech choices, demo, contribution table
.env.example           manual settings template (copy to .env)
.env.docker.example    separate Docker settings and host ports
scripts/               PowerShell setup/start checks and configuration doctor
docker-compose.yml     one-command local stack
docs/                  handover_note.md, api_endpoints.md, design/ (wireframes and user descriptions only)
sql/                   Part A DDL, indexes, triggers, procedure, materialized view, window query + 07_api_support.sql
mongo/                 schema.json (canonical definitions), setup.py, optional mongosh workflows
data_generation/       bootstrap.py, seeders and fresh_pings.py telemetry generator
performance/           Part A EXPLAIN / executionStats evidence
api/                   FastAPI server, compatibility launchers, integration tests
web/                   React + Material UI + Leaflet frontend, unit and browser tests
```

## Layout and platform update

All six screens use the available browser width with responsive 16–24 px side gutters. The fixed
1440 px workspace cap is removed. The map and analytics chart expand on large displays; Reviews
keeps its viewport layout and internal scrolling. Windows/Docker setup scripts and native platform
CI checks are included. Inter is bundled locally for consistent typography without an external font service. Details and explicit verification limits: `docs/handover_note.md`.

If the old centered layout remains visible, stop the previous Vite process (Ctrl+C), extract this
archive into a new folder, preserve your `.env`, install dependencies with `npm.cmd ci` inside `web`,
and launch from that new folder. Hard-refresh with Ctrl+Shift+R. The running server must use this
release's `web` sources. Docker users must rebuild the web image. See the layout notes for commands.

## The six screens

| Screen | Workflow | What it shows |
|---|---|---|
| Browse | - | Patients, clinics and appointments with server-side paging, search/filter and an inline detail view. Staff move appointments WAITING -> IN_CONSULTATION -> DISCHARGED from the detail view. |
| Transaction | Workflow 1 | Patients only (clinic staff see an access message). Books an appointment through `sp_execute_appointment`, shows the HSA balance before/after and the new `wallet_audit_logs` row. Insufficient balance and a second active visit (partial unique index) show friendly messages. |
| Audit trail | - | Patients only (clinic staff see an access message; the API answers `PATIENT_ONLY`). Read-only `wallet_audit_logs` for the session patient with a date filter, opening balance and running balance. Opens on the last 30 days, or on the 30 days up to the patient's latest entry when the last 30 days are empty. |
| Analytics | Workflow 2 + view | 7-day moving average chart (Part A window query), `DENSE_RANK()` ranking table, monthly discharges from the materialized view with "last refreshed" time and a refresh button (clinic staff). Opens on the latest dates that have discharged revenue, so an older database is not shown empty. |
| Map | Workflow 3 | `$geoNear` results around a selectable origin, fixed 5 km radius, list sorted by distance, polling every 10 s. |
| Reviews | Workflow 4 | `$facet` rating distribution, top tags, overall average and the flexible `MedicalCatalogs` documents. |

Demo actors are switched from the header (patient or clinic staff); real login is not required.

## Setup (manual)

Requirements: Python 3.12+, Node 22.14+ (22.x) or 24+, PostgreSQL 16+, MongoDB 7+ (`mongosh` is optional for the Python setup route).
Run every command from the repository root unless stated otherwise.

### 1. Settings

```bash
cp .env.example .env          # then edit user, password and database names for your machine
set -a; source .env; set +a   # load the settings into this terminal (repeat in every new terminal)
```

The Python tools load the root `.env` by themselves. External `psql` and `mongosh` commands require
the corresponding variables to be exported in your shell.
The root `.env` takes priority; an existing `api/.env` remains supported as a fallback. Keep one active settings file and never commit it. Editing `.env.example` alone does not configure the app.

### 2. Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r api/requirements.txt -r data_generation/requirements.txt
```

### 3. Databases

```bash
createdb "$PGDATABASE"                                                  # empty PostgreSQL database
python mongo/setup.py                                                # validators + indexes
python data_generation/bootstrap.py                                         # schema (sql/01-05, 07) + seed both stores
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
python data_generation/fresh_pings.py            # one round
python data_generation/fresh_pings.py --loop 30  # a round every 30 seconds until Ctrl+C
```

## Windows PowerShell (existing local databases)

You can use the scripts below instead of the longer direct commands that follow:

```powershell
# Keep your existing root .env or api/.env. If neither exists, the setup script
# creates a template and asks you to edit it before rerunning.
.\scripts\setup-windows.ps1 -Bootstrap
# Terminal 1:
.\scripts\start-api.ps1
# Terminal 2:
.\scripts\start-web.ps1
```

`-Bootstrap` checks both database connections and initializes an empty store/adds API support.
Omit it to install dependencies only. Add `-TestTools` to install backend test dependencies.
Scripts support paths containing spaces and call the virtual environment directly. If Windows
blocks downloaded PowerShell scripts, use the direct Python/npm commands below without changing
your machine's execution policy.


Extract this ZIP to a **new folder** and preserve your existing `.env` privately. Use your current
PostgreSQL database name (`postgres` is valid) in `DATABASE_URL`. The app does not require it to be
called `careconnect`. URL-encode special characters in the password.

From the extracted `careconnect` folder:

```powershell
# Only if there is no existing root .env or api/.env:
Copy-Item .env.example .env
# Edit .env: DATABASE_URL, CARECONNECT_MONGO_URI, CARECONNECT_MONGO_DB,
# and CARECONNECT_DEMO_MODE=true for this assignment demo.

py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r api/requirements.txt -r data_generation/requirements.txt
.\.venv\Scripts\python.exe data_generation/bootstrap.py
Set-Location api
..\.venv\Scripts\python.exe main.py
```

`py -3.12` selects an installed Python 3.12. If you use a newer Python, substitute its launcher
version. The commands call the virtual environment directly, so PowerShell activation is optional.
On an existing Part A database, ensure SQL 01–05 are already installed (tables, indexes, triggers,
procedure and materialized view). Bootstrap applies SQL 07 and the complete root MongoDB schema
(collections, validators and indexes) without resetting populated stores. No mongosh step is required.

In a second PowerShell terminal, from the same extracted folder:

```powershell
Set-Location web
Remove-Item Env:NAPI_RS_FORCE_WASI -ErrorAction SilentlyContinue
npm.cmd ci
npm.cmd run dev
```

Open **http://127.0.0.1:5173/**. This release uses Vite 6 and compatible React/test tooling, with a
regenerated lock file. Install with `npm.cmd ci` to replace the old/corrupt `node_modules`; do not
copy dependencies from the earlier ZIP. No WASI workaround or extra command-line flags are needed.
If a persisted Windows user variable `NAPI_RS_FORCE_WASI` was added previously, remove it in your
Windows environment settings too.

See `docs/handover_note.md` for current changes and verification.

## Setup (Docker)

Docker has its own settings file and named database volumes; your manual `.env` remains separate.
The default database host ports are **55432** (PostgreSQL) and **57017** (MongoDB), leaving the
standard ports available to your locally installed databases. The API host port is **8001**.

Windows PowerShell, from the repository root (Docker Desktop must use Linux containers):

```powershell
.\scripts\start-docker.ps1
.\scripts\test-docker.ps1
```

The start script creates `.env.docker` from `.env.docker.example` only if missing, checks the engine
and Compose configuration, builds the images and waits for health checks. On Linux/macOS:

```bash
cp .env.docker.example .env.docker   # once; retain it on subsequent starts
# Edit password/ports if desired before the first start.
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up --build --wait --wait-timeout 900
```

Open **http://127.0.0.1:8080** (API on http://127.0.0.1:8001). The first start creates both databases,
validators and indexes and seeds everything; later starts keep the data (`docker compose down -v`
removes it). Live map telemetry: `docker compose --env-file .env.docker exec api python ../data_generation/fresh_pings.py --loop 30`.
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
   Run `python data_generation/fresh_pings.py --loop 30` meanwhile to watch nurses move.
7. **Reviews**: rating distribution, top tags, average rating and one catalog document per page.

## Assumptions

- PostgreSQL and MongoDB run locally on their default ports.
- Appointment statuses are `WAITING`, `IN_CONSULTATION`, `DISCHARGED` and only move forward (trigger in
  `sql/03`). Only `DISCHARGED` appointments count as revenue and monthly discharges.
- The original SQL Workflow 2 reference reports 30 days; the API history variant supports all stored past dates with a 7-calendar-day `RANGE` window; days without revenue
  are excluded, not zero-filled. Monthly counts use the creation month in UTC.
- Money is exact decimal account units (no currency in the schema); copays with more than two decimals are
  rejected.
- GeoJSON coordinates are `[longitude, latitude]`; distances are metres. Pings expire two hours after
  `created_at`. The map shows each nurse's latest active location, not an older nearer ping.
- `wallet_audit_logs` is append-only. The seeder spreads the trigger-generated audit timestamps over the
  seeded 60 days (in id order) so the date filter is meaningful; running balances are unchanged.
- Reviews have no clinic id, so their charts are global. `patient_id` in reviews refers to PostgreSQL
  `patients.id`. Nurse names and home areas live in the `Nurses` collection; every nurse works around one
  clinic. Actual results depend on fresh pings, duty state and distance; a clinic is not guaranteed
  to have a matching active nurse. Origins far outside the area correctly show "No active nurses within 5 km".
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
- `app/main.py` application setup and error mapping; `app/routers/` endpoint definitions; `app/services.py` PostgreSQL work (browse, booking via
  `sp_execute_appointment`, status changes, audit, analytics - the Workflow 2 query is read from
  `sql/08_analytics_history.sql`, with SQL 06 kept as the original reference); `app/mongo_services.py` `$geoNear`, `$facet` and catalog paging;
  `app/security.py` server sessions, CSRF and Origin checks; `app/config.py` settings from the root `.env`.
- `data_generation/bootstrap.py` installs `sql/01`-`05` and `07` on an empty database and seeds empty stores;
  `data_generation/fresh_pings.py [--loop N]` is the nurse-telemetry simulator (demo mode only).
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
semantics. `cd web && npm run test:live` checks the running stack end to end. Details: `docs/handover_note.md`.

## Submission metadata

- Inherited repository URL: https://github.com/NirupamaRanjan/23_a1b/tree/a2-fixes
- Inherited source commit: `22efe1638f8e2c53314a95d36b9424d7944f3740`
- **Final team repository URL:** fill after pushing.
- **Final submission commit:** fill with the pushed revision.
- **Demo video (<= 5 min):** add your final reviewed demo link here - replace with your team's recording link.
- **Screenshots:** link final screenshots here; keep the requested docs folder structure.

| Team member | Design contribution | Code/test contribution |
|---|---|---|
| Member 1 | Fill honestly | Fill honestly |
| Member 2 | Fill honestly | Fill honestly |
| Member 3 | Fill honestly | Fill honestly |
| Member 4 | Fill honestly | Fill honestly |

More detail: `docs/handover_note.md` (changes to Part A), `docs/api_endpoints.md` (API),
`web/docs/API_CONTRACT.md` and `web/docs/SECURITY.md` (frontend contract and security notes),
`docs/design/` (wireframes and users).

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

## Current update: location, dates and empty results

Map asks for the real device location on entry. Allow browser location permission; local Vite
works on localhost/127.0.0.1, while hosted access needs HTTPS. A device may report an approximate
position; the UI shows its reported accuracy. Denial/timeouts leave manual coordinates and
Use selected clinic available. Clinics do not override a chosen user origin. No simulation data
is generated around the device automatically.

All new generated clinic/nurse positions are confined to small inland Indian service areas, mainly
Hyderabad and other Telangana cities, plus Andhra Pradesh, Karnataka and Maharashtra. This is
synthetic demonstration coverage, not nationwide live nurse availability. A location inside India
can still legitimately have zero active nurses within 5 km.

Existing foreign demo locations are preserved until you explicitly relocate them. Stop the telemetry
loop, then run from the project root using the same configured Python/environment as the API:

```powershell
python data_generation/relocate_india.py
python data_generation/relocate_india.py --apply
python data_generation/fresh_pings.py --loop 30
```

The first command previews counts without writing. Apply changes only clinic coordinates, nurse
homes and ping coordinates outside the allowed Indian service areas; it does not delete data,
change IDs, balances, appointments, audit history, reviews, active flags or timestamps. It is
idempotent and can be rerun if an interrupted migration leaves some points. PostgreSQL and MongoDB
are not a single atomic transaction. Old pings stay old; fresh_pings creates new demo telemetry.
Do not run postgres_seeder.py or mongo_seeder.py --reset-data to repair an existing database.
Normal bootstrap continues to preserve populated stores. The telemetry loop requires demo mode.

Audit starts with the last 30 UTC calendar dates, including today. Apply dates saves the patient-specific
range across navigation and reload in the same tab. Last 30 days resets it. Edited dates show an
unapplied notice until submitted. The Current HSA balance is always the latest stored balance;
other period values use the applied dates. Analytics opens with both date fields populated and
passes those exact dates to the revenue query. Invalid/empty ranges do not display a chart.

Shared empty states include local vector artwork, explanations and relevant actions throughout
the six screens. Fonts and the existing application palette are retained.

`docs/` contains only handover_note.md, api_endpoints.md and design/. Design includes the supplied
Figma URL, original six offline SVG wireframes and user descriptions. The Figma file was not
accessible for verifying/exporting its frames in this session.


## Analytics dates and zero totals

**Why Analytics (and the Audit trail) looked empty:** seeded demo data covers the 60 days before
the day the seeder ran and never moves forward by itself. Once a database is more than about a
month old, "the last 30 days", "today's ranking" and "this month" contain no discharged revenue.
The Analytics screen now asks `GET /api/v1/analytics/coverage` for the latest recorded revenue
dates and opens the chart (30 days), ranking date and month there, with a note saying so; the Audit
trail does the same with the patient's latest entry. Dates you change yourself are kept. To get
current dates again instead, reseed PostgreSQL (`python data_generation/postgres_seeder.py`, which
replaces the relational demo data) and refresh the monthly view.

Thirty days is the initial chart range, not a limit on historical selection. Older chart and ranking
dates are now supported through today. The selected-period revenue card follows the chart dates;
monthly discharges follow the independent Month selector. The API uses SELECT-only
sql/08_analytics_history.sql; no schema migration/reseed is required. Restart the API/frontend after
copying the updated source. The original sql/06_window_analytics.sql remains a 30-day reference.

For empty/zero results, run `python scripts/check-analytics.py --clinic-id 13` from the project root.
This reads the API's PostgreSQL connection and reports actual appointment statuses/date coverage
and period revenue. Add `--start-date YYYY-MM-DD --end-date YYYY-MM-DD` to inspect another range.
The command never changes data. Only DISCHARGED appointments count; a refreshed materialized view
cannot manufacture missing revenue. See docs/handover_note.md for the correction and verification.
