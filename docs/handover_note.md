# CareConnect handover note

## Inherited application

This update starts from the user's latest uploaded CareConnect ZIP. PostgreSQL owns patients,
clinics, appointments and wallet audit history; MongoDB careconnect_a2 owns nurse telemetry, review
facets and medical catalogs. The uploaded SQL session/retry/refresh support and nurse-directory
implementation are retained. No new database tables, columns or collections were added by this
update. Original SQL business rules, booking procedure, audit immutability and 5 km latest/active
nurse-search semantics remain in place.

Inherited source reference supplied in the project: 23_a1b/a2-fixes,
commit 22efe1638f8e2c53314a95d36b9424d7944f3740. Add the final team repository and commit
in the root README before submission; do not invent contribution names.

## Changes and reasons

- Clinic staff can no longer see patient-only screens. Transaction and Audit trail show an access
  message with a link to Browse instead of the booking form or ledger, and `GET /me/audit` returns
  403 `PATIENT_ONLY` for staff (previously a staff session still returned the last patient's ledger).
- Analytics was empty on any database seeded more than about 30 days earlier, because the chart,
  ranking and month defaulted to "now". `GET /analytics/coverage` reports the latest DISCHARGED
  revenue dates, and the screen opens on them with an explanatory note (dates the user edits are
  kept). The Audit trail moves its default 30-day range to the patient's latest entry
  (`latest_entry_date` in the audit response) in the same situation.
- Housekeeping: restored the missing `.env.example` and `.env.docker.example` (README, PowerShell
  scripts and CI copy them); `postgres_seeder.py` now uses the same root `.env` connection as the
  API; removed files the documentation already described as removed (`api/app/mongo_setup.py`,
  `api/docker-compose.yml`), leftover `package*.before-fix.json`, committed `.pyc` files and the
  unused axios dependency; a stopped API now reports "Could not reach the CareConnect API" instead of
  "unexpected response".
- Map requests the device's current browser position on entry; it waits for a usable origin
  before requesting nurses. It shows reported position accuracy. Denial, timeout or missing
  browser support has a clear message and manual/clinic recovery. Pending callbacks cannot
  override a manual selection or update an unmounted screen. Switching the selected clinic
  does not silently move a device/manual origin; Use selected clinic is explicit.
- Location generation shares inland Indian service circles around Hyderabad and other Telangana
  cities, Andhra Pradesh, Karnataka and Maharashtra. Fresh SQL clinic coordinates, nurse homes,
  walks, fallback points and emitted ping checks all use this constraint. Faker names use en_IN.
  This deliberately generates a subset of India and is not a claim of nationwide nurse coverage.
- Existing demo coordinates can be relocated with data_generation/relocate_india.py. Its default
  is a read-only preview; --apply updates locations outside these service areas. It preserves
  IDs, names, duty flags, timestamps, patients, appointments, balances, audit records, reviews
  and catalogs. It does not reseed or freshen old timestamps. Stop demo telemetry during migration.
  It is rerunnable; PostgreSQL and Mongo writes do not form one atomic transaction.
- NursePings validation accepts either the existing active boolean or canonical is_active boolean,
  so legacy field names also work when location-only migration updates a document. The API's
  existing active/name compatibility and canonical precedence are retained.
- Analytics opens with both chart date fields populated and sends the same explicit range.
  Dates are UTC; the initial range is the last 30 calendar dates including today. Clearing or
  invalidating a date prevents displaying a misleading chart. Thirty days is only the default: the chart and ranking support older stored history. The revenue card now sums the selected chart period; monthly discharges follow the month picker.
- Audit starts with the patient's last 30 calendar dates including today. Applied dates are stored
  per patient in per-tab sessionStorage and restored on navigation and refresh. Unsubmitted edits
  are visibly labelled; Apply dates updates all period results and resets pagination. Last 30 days
  resets the range. Current HSA balance always means the latest balance; opening balance/count
  use the applied range. Browser storage is a UI preference, never proof of authorization.
- API resource state is keyed by actor/query so an earlier response cannot momentarily appear as
  another patient's/date range's data. Existing request cancellation and permissions are retained.
- Reusable local teal vector empty states replace sparse no-results messages and selection
  placeholders across all six screens. Actions clear filters, reset dates, refresh results or
  show all specialties as appropriate. Loading and request failure are separate states.
- docs contains only this handover, api_endpoints.md and design/. Design includes user descriptions,
  six supplied SVG wireframes (coordinate examples updated to India) and the user's Figma URL.
  The Figma file was inaccessible here; SVGs are not claimed to be new Figma exports.

## Upgrade and demo data

Extract into a new folder, preserve the existing active .env and install dependencies with the
same Python interpreter used for the API. From the project root:

```powershell
python -m pip install -r api/requirements.txt -r data_generation/requirements.txt
python mongo/setup.py
python data_generation/relocate_india.py
python data_generation/relocate_india.py --apply
python data_generation/fresh_pings.py --loop 30
```

Preview first, then apply the requested demo location migration. For an existing populated system,
do not invoke the destructive postgres seeder or Mongo --reset-data. Bootstrap preserves populated
stores and is appropriate for a genuinely fresh install. Full setup/launch instructions stay in the
root README. Restart API/frontend from the new folder and refresh the browser. For Docker, use
`docker compose --env-file .env.docker run --rm api python /app/data_generation/relocate_india.py --apply`
after the services are ready (the image includes the root source at /app); use the corresponding
container command for ongoing telemetry. See docker-compose.yml for your host port/volume settings.

Browser location requires permission and HTTPS or localhost. Actual accuracy depends on the device.
India-only generation does not guarantee active nurses within 5 km of every user; real telemetry
is required for real availability. The two-hour ping freshness/TTL and latest-offline exclusion are
intentional. Demo telemetry must run to keep synthetic pings fresh after expiry.

## Verification performed for this update

- 34 backend/configuration/geography/migration tests passed against PostgreSQL 16 and MongoDB 7.0.16.
  Geography tests include 100,000 walk steps, service-area edge rejection, foreign legacy inputs,
  and a read-only preview/idempotent migration that preserves patient, appointment and audit data.
- 21 frontend unit tests passed, including UTC/leap-date defaults, independent patient preferences,
  invalid saved data and empty/loading/error separation.
- 34 isolated Chromium browser scenarios passed: automatic location, permission denial, timeout,
  unavailable location, late callbacks, initial query/date agreement, navigation/reload/patient
  date restoration, all six empty flows, existing booking/map/paging behaviour and responsive
  layouts down to 320 px and up to 2560 px.
- Node 22.14 production build passed. The live six-screen booking/debit/audit/status/discharge/
  analytics-refresh workflow completed against the real seeded local databases.
- A full fresh seed produced 1,000 patients, 50 clinics, 50,000 appointments, 100,000 audit rows,
  500 nurse homes and 500,000 pings. Every generated clinic/home/ping was checked against the
  permitted inland service areas. Hyderabad returned 10 active nurses; a fresh telemetry round
  inserted 500 further India-only pings. A relocation preview found zero out-of-area generated points.

These are Linux test results, not a native Windows, Docker engine, real-device GPS or the user's
local database test. Browser geolocation is simulated through Chromium's location facilities in
automated checks. Figma frame contents and its sharing permissions were not verified.

## Remaining submission items

Add genuine team contributions, final repository/commit, reviewed demo link and any screenshots
required by the instructor in the root README. Ensure reviewers can open the supplied Figma link.
The supplied folder screenshot did not mandate SVG versus Figma; both references are included.
Demo actor switching remains an assignment convenience, not production authentication.


## Analytics history correction

The earlier UI/API/SQL all restricted revenue dates to the latest 30 days. The initial view still
uses 30 calendar dates, but arbitrary past dates are now selectable through today. SQL 06 remains
the original assignment reference; SQL 08 is a SELECT-only history variant read by AnalyticsService.
It groups discharged revenue in UTC and keeps the seven-calendar-day RANGE average and DENSE_RANK.
Visible date filtering occurs after the window calculation, so shortening the displayed interval
does not erase the preceding six days needed for the moving average. The revenue card now sums
exactly the selected clinic's displayed-period daily totals. No records or statuses are fabricated.
Monthly discharges use their independent month selector and materialized-view refresh.

Install by copying the updated source (including sql/08_analytics_history.sql) and restarting the
API/frontend. No database setup, migration or reseed is required for this correction.
To diagnose zero values against the actual API connection, run from the project root:

```powershell
python scripts/check-analytics.py --clinic-id 13
```

Optional --start-date/--end-date flags accept ISO dates. The command uses a read-only PostgreSQL
transaction and reports database/server date, statuses, date coverage, selected-clinic period
counts/revenue and clinics with discharged history. It never reseeds, renames or changes status.
No matching DISCHARGED appointments means zero is correct; refreshing the monthly view does not
create appointments or revenue. The user's local database has not been inspected remotely.

Verification for this correction: 36 backend tests passed, including 90-day-old revenue, correct
seven-day lookback, tied historical ranks, period totals, empty data and invalid/future ranges.
21 frontend unit tests and the Node 22.14 production build passed. Both focused Analytics browser
scenarios passed, including dates 90–120 days in the past and the initial default/query match.
The read-only diagnostic also ran against the disposable database. Earlier screen/geography
checks above describe the preceding release, not additional reruns for this analytics-only change.
