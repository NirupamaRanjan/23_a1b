# CareConnect handover note

## Sources and scope

Inherited repository: https://github.com/NirupamaRanjan/23_a1b/tree/a2-fixes, commit `22efe1638f8e2c53314a95d36b9424d7944f3740`. The existing frontend is the user's `CareConnect_React_Six_Screens.zip`; its six React routes and API client are retained. The supplied PDF is titled Assignment 2 despite its filename Assignment1b.pdf. The style reference is https://github.com/niral261/spotify2MP3, commit `962bba375ae182822b839d561c875f5c0135878d`.

## What worked

The relational schema, partial active-appointment unique index, positive copay/nonnegative HSA checks, audit trigger, append-only audit guards and monotonic appointment status trigger are coherent. The procedure locks the patient before debiting and inserts WAITING appointments atomically. Its failed unique-index insert rolls back both the debit and trigger row. The calendar RANGE analytics query and DENSE_RANK return ties correctly. The materialized view has the unique index required for concurrent refresh. MongoDB provides validators, a 2dsphere index, two-hour TTL, review facet and flexible catalogs. Original Part A scripts and seeders are retained.

## Gaps and changes

The inherited repository contains no web or HTTP API; the recovered frontend describes a contract rather than supplying a backend. We added a thin FastAPI adapter with class-based services, a bounded PostgreSQL connection pool, PyMongo, safe public failures, trusted server sessions, CSRF verification, parameterized SQL, literal search and stable pagination. Booking captures the exact trigger row while holding the patient lock. Additive `sql/07_api_support.sql` persists opaque sessions, booking idempotency results and real refresh timestamps, and adds browsing/audit indexes. No Part A table, stored procedure or existing trigger was rewritten. Analytics executes `sql/06_window_analytics.sql` rather than implementing window functions in Python.

The original geo pipeline keeps the nearest historical ping per nurse; that can show a nurse who has since gone offline or left the radius. The API retains $geoNear and the 5 km index-based candidate search, selects the latest nearby candidate, then uses $lookup to verify that it is the nurse's latest ping across all locations/statuses. It enforces freshness explicitly while TTL deletion catches up. The `(nurse_id, created_at, _id)` index in `mongo/01_collections_and_indexes.js` supports this check. The assigned standalone workflow files remain unchanged for comparison.

The inherited Assignment 1 README described `IN CONSULTATION`; the DDL, API and current README use `IN_CONSULTATION`. Mongo seeding already replaces collections and relational seeding already disables ledger guards for a privileged reset, despite outdated inherited README claims. Bootstrap runs these destructive seeders only when the respective store is empty; it does not reseed an existing store. Fresh-ping tooling appends telemetry without resetting reviews/catalogs.

## Suggestions

Keep documentation literals synchronized with DDL; make script return shapes explicit; add generated-ID outputs to the procedure if a future API requires them; document that the 7-day average uses only recorded revenue days; separate development reset tools from application credentials; retain current-ping semantics in future telemetry changes. The demo uses explicit local actor switching, not production authentication. Full production identity integration is outside the assignment.

A live-browser check also found that React StrictMode could race two initial session requests. The API client now shares an in-flight session request; a regression test protects cookie/CSRF alignment while preserving the six-screen UI.

## Assignment 2 integration fixes

- Repository layout follows the suggested structure: `sql/`, `mongo/`, `data_generation/` and `docs/` at the root. The API, bootstrap script, tests, `api/Dockerfile` (built from the repository root) and the root `docker-compose.yml` read those folders.
- `sql/07_api_support.sql` is part of every setup path (bootstrap, tests, manual steps). The latest-ping-per-nurse index lives in `mongo/01_collections_and_indexes.js`.
- One root `.env` (`.env.example`) holds every setting for `psql`, the seeders and the API.
- Seeders use Faker for patient, clinic, nurse and physician names. A `Nurses` collection keeps nurse names beyond the 2-hour ping TTL; pings carry `nurse_name` and `scripts/fresh_pings.py` reuses it. The Mongo seeder again replaces old data and seeds the 40 `MedicalCatalogs` documents.
- The PostgreSQL seeder mixes HSA debits with credits and spreads the trigger-generated audit timestamps over the seeded 60 days so the Audit trail date filter is meaningful; running balances are unchanged.
- Nurse telemetry: every nurse has a home area near one of the clinics (`data_generation/nurse_telemetry.py`); seeded pings form small movements over the last 100 minutes, and `scripts/fresh_pings.py [--loop N]` continues them, so every clinic has nurses within 5 km and pings no longer expire all at once.
- About 20% of clinics are seeded as not accepting patients (clinic 1 always accepts).
- The Audit trail lists newest entries first.
- Error responses use specific codes (for example `CLINIC_NOT_FOUND`, `PATIENT_ONLY`, `STAFF_ONLY`, `OTHER_CLINIC`, `INVALID_DATE_RANGE`, `DATE_OUTSIDE_WINDOW`, `POSTGRES_UNAVAILABLE`, `MONGO_UNAVAILABLE`, `DATABASE_SETUP_INCOMPLETE`) and the frontend explains each one instead of a generic message.
- UI: the Map lists nurses by name, Analytics explains that only clinic staff can refresh the materialized-view summary and keeps the ranking date inside the Clinic ranking section, and a patient's Patients tab in Browse has no search box (it only contains their own record). No colours, fonts or layout were changed.
- Reviews screen: the summary shows the average as stars, the share of patients who rated 4–5 stars and the number of reviews; the rating distribution shows percentages; catalog entries show specialty and physician first, readable field names and the catalog id under "Additional fields"; specialty chips (from `GET /catalogs/specialties`) replace free-text search.
