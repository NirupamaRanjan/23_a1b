# CareConnect – On-Demand Telemedicine (Assignment 2: Front End Design)

A six-screen web application built on the Assignment 1 CareConnect databases (Project 4).
**PostgreSQL** owns patients, clinics, appointments, HSA payments, the audit ledger, status rules,
the 7-day moving-average analytics and the monthly materialized view. **MongoDB** (`medical_db`)
owns nurse telemetry (nearest active nurse within 5 km), patient-review facets and the flexible
medical catalog. A **FastAPI** server (`api/`) sits between the **React** frontend (`web/`) and both
databases; the browser never talks to a database directly.

| | |
|---|---|
| **Team repository** | `https://github.com/NirupamaRanjan/23_a1b` |
| **Final commit hash** | `4de590ec8fb44797ef921d190112392140b51ae4` |
| **Demo video (≤ 5 min)** | `https://drive.google.com/file/d/1NopyPzG4QD9tq_GTgbCpfWoYvimI6M6z/view?usp=sharing` |

**Contents:** [Repository structure](#repository-structure) · [The six screens](#the-six-screens) ·
[Screenshots](#screenshots) · [Setup](#setup) · [Demo walkthrough](#demo-walkthrough) ·
[Assumptions](#assumptions) · [Tech choices](#tech-choices) · [Tests](#tests) ·
[Contribution table](#contribution-table) · [Submission details](#submission-details) ·
[Assignment 1 evidence](#assignment-1-evidence)

## Repository structure

```text
<new_team_number>_a1b/
├── README.md                 setup steps, assumptions, tech choices, screenshots,
│                             contribution table, repo URL + final commit hash, demo link
├── docs/
│   ├── handover_note.md      inherited system, what worked/failed, changes and reasons
│   ├── api_endpoints.md      every API endpoint with inputs, outputs and error codes
│   ├── design/               wireframes (SVG) and user descriptions
│   └── screenshots/          PNG screenshots of the six screens (shown below)
├── sql/  mongo/  data_generation/     from Part A (+ our fixes)
├── api/                      FastAPI server layer and integration tests
├── web/                      React + Material UI + Leaflet frontend, unit and browser tests
├── performance/              Part A EXPLAIN / executionStats evidence
├── .env.example              settings template for a manual setup (copy to .env)
├── .env.docker.example       settings template for Docker (copy to .env.docker)
└── docker-compose.yml        optional one-command local stack
```

## The six screens

| Screen | Workflow | What it does |
|---|---|---|
| **Browse** | – | Patients, clinics and appointments with server-side paging, search and filters, and an inline detail panel. Clinic staff move appointments WAITING → IN_CONSULTATION → DISCHARGED from the detail panel. |
| **Transaction** | Workflow 1 | Books an appointment through `sp_execute_appointment`; shows the HSA balance before/after and the audit row written by the trigger. Friendly messages for insufficient balance, an already active visit and non-accepting clinics. **Patients only.** |
| **Audit trail** | – | Read-only `wallet_audit_logs` for the session patient, newest first, with a date filter, opening balance and running balance. **Patients only.** |
| **Analytics** | Workflow 2 + view | 7-day moving-average revenue chart (`RANGE` window), `DENSE_RANK()` clinic ranking, monthly discharges from the materialized view with "last refreshed" time and a refresh button for clinic staff. |
| **Map** | Workflow 3 | `$geoNear` search for active nurses within a fixed 5 km of your location, typed coordinates, a map click or the selected clinic; results sorted by distance and refreshed every 10 s. |
| **Reviews** | Workflow 4 | `$facet` rating distribution, top bedside-manner tags and overall average, plus the flexible `MedicalCatalogs` documents filtered by specialty. |

Demo actors are switched from the header ("Acting as": a patient or a clinic's staff); there is no
login screen. A clinic-staff actor's ID is the clinic's ID. Clinic staff see an access message
instead of Transaction and Audit trail, and the API rejects their requests with `PATIENT_ONLY`.

## Screenshots

Captured from the running application with seeded data (1440 px wide). Wireframes for the same
screens are in [`docs/design/wireframes/`](docs/design/wireframes/).

| | |
|---|---|
| **Browse** – clinic details open inline<br>![Browse](docs/screenshots/01_browse.png) | **Transaction** – booking result and trigger audit row<br>![Transaction](docs/screenshots/02_transaction.png) |
| **Audit trail** – newest entry first<br>![Audit trail](docs/screenshots/03_audit_trail.png) | **Analytics** – moving average, ranking, monthly view<br>![Analytics](docs/screenshots/04_analytics.png) |
| **Map** – nearest active nurses within 5 km<br>![Map](docs/screenshots/05_map.png) | **Reviews** – review facets and medical catalog<br>![Reviews](docs/screenshots/06_reviews.png) |

## Setup

Requirements: **Python 3.12+**, **Node 22.14+** (or 24+), **PostgreSQL 16+**, **MongoDB 7+**.
Run every command from the repository root unless a step says otherwise. The commands are for
macOS/Linux; Windows PowerShell equivalents are in [Windows notes](#windows-notes).

### 1. Settings

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/careconnect
PGUSER=postgres
PGPASSWORD=YOUR_PASSWORD
PGDATABASE=careconnect
CARECONNECT_MONGO_URI=mongodb://localhost:27017/
CARECONNECT_MONGO_DB=medical_db
CARECONNECT_DEMO_MODE=true
```

- Any PostgreSQL database name works; URL-encode special characters (`@`, `#`, …) in the password inside `DATABASE_URL`.
- The MongoDB database must be `medical_db`.
- The API, seeders and helper scripts read the root `.env` themselves. For `psql`/`createdb`, load it
  into the terminal: `set -a; source .env; set +a` (repeat in each new terminal). Never commit `.env`.

### 2. Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt -r data_generation/requirements.txt
```

### 3. Create the databases and seed the data

```bash
createdb "$PGDATABASE"                  # skip if the database already exists
python mongo/setup.py                   # MongoDB collections, validators and indexes
python mongo/setup.py --check           # should end with "OK"
python data_generation/bootstrap.py     # PostgreSQL schema + seed both databases
```

`bootstrap.py` installs `sql/01`–`05` and `sql/07_api_support.sql` on an empty database, seeds
**1,000 patients, 50 clinics, 50,000 appointments, 100,000 audit entries, 500 nurses, 500,000 nurse
pings, 5,000 reviews and 40 catalog documents**, and refreshes the monthly view. It only seeds
empty stores, so it is safe to run again (it never overwrites data).

To **wipe and reseed** an existing database instead (PostgreSQL first, because nurses are placed
around the clinic locations):

```bash
python data_generation/postgres_seeder.py              # replaces all PostgreSQL demo data
psql -c 'SELECT refresh_clinic_monthly_discharges();'
python data_generation/mongo_seeder.py --reset-data    # replaces all MongoDB demo data
```

### 4. Start the backend (terminal 1)

```bash
source .venv/bin/activate
cd api
python main.py
```

The API runs on http://127.0.0.1:8000 (health: `/api/health`, interactive docs: `/api/docs`).

### 5. Start the frontend (terminal 2)

```bash
cd web
npm ci            # first time, or after dependency changes
npm run dev
```

Open **http://127.0.0.1:5173**. Vite forwards `/api` to the API, so cookies and CSRF checks stay on
one origin (`CARECONNECT_API_PROXY` in `.env` changes the target).

### 6. Live nurse pings for the Map (terminal 3, optional)

Nurse pings expire two hours after they are created (TTL index), and the seeder does not re-create
pings while nurses still exist. For a live demo, keep the telemetry simulator running; it adds one
current ping per nurse every round:

```bash
source .venv/bin/activate
python data_generation/fresh_pings.py --loop 30
```

### Docker (alternative to steps 1–6)

```bash
cp .env.docker.example .env.docker     # once; defaults avoid clashing with local databases
docker compose --env-file .env.docker up --build --wait
```

Open http://127.0.0.1:8080 (API on http://127.0.0.1:8001). The first start creates and seeds both
databases in their own volumes; `docker compose --env-file .env.docker down -v` removes them.
Live pings: `docker compose --env-file .env.docker exec api python ../data_generation/fresh_pings.py --loop 30`.

### Windows notes

Use `Copy-Item .env.example .env`, `py -3.12 -m venv .venv`, `.\.venv\Scripts\Activate.ps1` and
`npm.cmd ci` / `npm.cmd run dev`; every other command is the same. `scripts\setup-windows.ps1`,
`scripts\start-api.ps1` and `scripts\start-web.ps1` wrap these steps.

### Troubleshooting

| Problem | Fix |
|---|---|
| "Could not reach the CareConnect API" | The backend is not running – start step 4. |
| `CARECONNECT_MONGO_DB` error | Set it to `medical_db` in `.env` and run `unset CARECONNECT_MONGO_DB` in that terminal. |
| Map shows no nurses | Pings are older than two hours – run step 6, then **Refresh now**. Nurses are seeded around Hyderabad and other South/Central Indian cities; "Use selected clinic" always lies inside that area. |
| "Last refreshed" shows — | Switch to clinic staff in the header and click **Refresh summary**. |
| Analytics shows an "older data" note | The database was seeded more than a month ago; the screen opens on the latest recorded dates. Reseed (step 3) for current dates. `python scripts/check-analytics.py --clinic-id 1` reports what is stored. |

## Demo walkthrough

1. **Browse** clinics, patients and appointments; search, filter "Accepting", page and open details.
2. Click **Book at this clinic**, enter a copay and book. Transaction shows the balance before/after and the
   trigger-generated audit row. Book again to see the active-visit message (partial unique index); try a
   copay above the balance to see the insufficient-HSA message.
3. **Audit trail** shows the new debit first; change the dates to see the opening and running balance.
4. Switch the header to **clinic staff** of the booked clinic. Transaction and Audit trail now show an
   access message. In **Browse → Appointments** move the visit WAITING → IN_CONSULTATION → DISCHARGED.
5. **Analytics**: pick dates for the moving average and a date for the ranking; as staff, **Refresh summary**
   updates the monthly discharges and the "last refreshed" time.
6. **Map**: allow location access or use coordinates/the selected clinic; results refresh every 10 s while
   `fresh_pings.py` moves the nurses.
7. **Reviews**: rating distribution, top tags, average rating and one catalog document per page by specialty.

## Assumptions

- PostgreSQL and MongoDB run locally (or in Docker); the MongoDB database is `medical_db`.
- Appointment statuses are `WAITING`, `IN_CONSULTATION`, `DISCHARGED` and only move forward (trigger in
  `sql/03`). Only `DISCHARGED` appointments count as revenue and monthly discharges.
- Workflow 2 keeps the assignment's 7-calendar-day `RANGE` window and `DENSE_RANK()`. `sql/06` is the original
  30-day reference; the API reads `sql/08_analytics_history.sql`, the same query over all stored dates, so
  older dates can be chosen. Days without revenue are excluded, not zero-filled. All dates are UTC.
- Seeded data covers the 60 days before the seeder ran and does not move forward. Analytics and the Audit
  trail therefore open on the latest recorded dates when "the last 30 days" are empty, and say so.
- Money is exact decimal HSA account units (the schema has no currency); copays have at most two decimals.
- GeoJSON coordinates are `[longitude, latitude]` and distances are metres. Pings expire two hours after
  `created_at`; the Map shows each nurse's **latest** ping only, and only if it is active and within 5 km.
- Generated clinics and nurses lie in inland Indian service areas (mainly Hyderabad, plus other cities in
  Telangana, Andhra Pradesh, Karnataka and Maharashtra) with Faker `en_IN` names. Origins elsewhere can
  correctly return no nurses.
- About 20% of clinics are seeded as not accepting patients; clinic 1, the default clinic, always accepts.
- `wallet_audit_logs` is append-only. The seeder spreads the trigger-generated audit timestamps over the
  seeded 60 days so the date filter is meaningful; running balances are unchanged.
- Reviews have no clinic ID, so review charts are global. `patient_id` in reviews refers to `patients.id`.
- Sessions, CSRF tokens, booking idempotency keys and the view's last-refresh time are stored in the tables
  of `sql/07_api_support.sql`; Part A tables, triggers and the procedure are not changed by it.
- Demo actor switching replaces a real login and is enabled only when `CARECONNECT_DEMO_MODE=true`.

## Tech choices

- **React 19 + Material UI + Leaflet (Vite)** – the inherited frontend stack: MUI gives accessible
  tables, forms and dialogs; Leaflet with OpenStreetMap shows the 5 km search without an API key. All
  colours live in `web/src/colors.js`; the Inter font is bundled locally.
- **FastAPI** – typed request validation (Pydantic) and generated API docs at `/api/docs`.
- **psycopg2 and PyMongo** – the same drivers as the seeders, so the API calls the Part A SQL procedure,
  trigger and window query and the Part A MongoDB pipelines directly instead of re-implementing them.
- **Server-side sessions** – HttpOnly SameSite=Strict cookies, CSRF token + Origin check on every change,
  idempotency keys for bookings, parameterised SQL and escaped MongoDB search.
- **Faker** – realistic generated names; **Docker Compose** – a reproducible stack for a new person.

## Tests

```bash
# Frontend: unit tests, production build and browser tests (browser tests use test-only API fixtures)
cd web && npm test && npm run build && npx playwright install chromium && npm run test:e2e

# API integration tests against disposable databases (the PostgreSQL name must end in _test)
createdb careconnect_test
cd api && pip install -r requirements-dev.txt && pytest tests -q
```

The API tests read `CARECONNECT_TEST_DATABASE_URL` and `CARECONNECT_TEST_MONGO_URI` from `.env` and cover
booking success and rollback, audit rows, copay precision, permissions (including patient-only audit),
CSRF, retries, concurrency, status transitions, `RANGE`/`DENSE_RANK`, latest-data coverage, refresh
conflicts, search, paging and nearest-nurse rules. `cd web && npm run test:live` checks a running stack.

## Contribution table

| Team member | Roll number | Design contribution | Code / test contribution |
|---|---|---|---|
| `Nirupama Ranjan` | `2026201053` | `User descriptions (docs/design/users.md); Audit trail and Analytics wireframes` | `Workflow 2 RANGE window and DENSE_RANK() (sql/06) and all-dates version sql/08; analytics coverage endpoint; frontend shell, header and actor switching; Browse, Transaction, Audit trail and Analytics screens (staff access messages, latest-data defaults); frontend unit tests` |
| `Shreya Debnath` | `2026201052` | `Visual style (colours, logo, type, empty states); Map and Reviews wireframes` | `MongoDB fixes: validators and indexes, 5 km latest-ping $geoNear (mongo/); mongo_seeder.py, Indian service areas, fresh_pings.py and bootstrap.py; Map and Reviews screens; Playwright browser tests; Docker setup; README, screenshots and demo video` |
| `Niral Ajmera` | `2026201045` | `API design and endpoint sketch (docs/api_endpoints.md); Transaction wireframe` | `Hardened sp_execute_appointment, UTC materialized view and refresh function (sql/04–05); sql/07_api_support.sql; FastAPI server in api/ (sessions, CSRF, permissions incl. patient-only audit, booking with idempotency, status changes, MongoDB services, error codes); API integration tests` |
| `Shaifali Vashistha` | `2026204018` | `Handover review of the inherited Part A code; Browse wireframe` | `Part A PostgreSQL fixes: IN_CONSULTATION status and forward-only status trigger, append-only wallet_audit_logs, RESTRICT foreign keys and CHECK rules (sql/01–03); postgres_seeder.py (Faker en_IN names, spread audit timestamps, non-accepting clinics); docs/handover_note.md` |

## Assignment 1 evidence

### Stress-test results

| Store | Generated data | Verified count |
|---|---:|---:|
| PostgreSQL `appointments` | 50,000 | 50,000 |
| PostgreSQL `wallet_audit_logs` | 100,000 trigger-generated rows | 100,000 |
| MongoDB `NursePings` | 500,000 | 500,000 before TTL expiry |
| MongoDB `PatientReviews` | 5,000 | 5,000 |

### Performance proof

Raw output: `performance/postgres_explain_analyzes.txt`, `performance/mongo_execution_stats.json` and
`performance/review_map_timing.json`.

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
maxDistance: 5000
```

MongoDB Workflow 4 (`explain("executionStats")` on 5,000 reviews):

```text
stage: IXSCAN
indexName: rating_1
totalKeysExamined: 5000
totalDocsExamined: 5000
```
