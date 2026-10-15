# Handover Note — CareConnect (Assignment 2)

## 1. Overview and testing
CareConnect is a PostgreSQL and MongoDB project inherited from the Assignment 1 team. I tested the Part A code with three suites I wrote (102 SQL, 12 parallel-session and 40 MongoDB tests) and fixed it on branch `a2-fixes`. My teammates then added the FastAPI server and six React screens. I also ran 243 API checks against the team's earlier API/web build under Docker. 

## 2. What worked and what did not
**Worked (original code):** the schema, indexes, audit trigger and seeders ran with the expected counts (50,000 appointments, 100,000 audit rows, 500,000 pings, 5,000 reviews). The 12 concurrency tests, `$geoNear` distances, the 2-hour TTL and `$facet` counts were all correct.

**Did not work:** only 76 of 102 SQL and 20 of 40 MongoDB tests passed.
- The README's `refresh_clinic_monthly_discharges()` step failed; the function did not exist.
- Audit rows could be updated, deleted and truncated, and deleting a patient or clinic cascaded into history.
- The booking procedure accepted unknown or non-accepting clinics; a copay of 10.005 debited 10.00 but was stored as 10.01.
- Workflow 2 had no `DISCHARGED` or 30-day filter, `ROWS BETWEEN 6 PRECEDING` is not 7 days, and monthly buckets changed with the session time zone.
- Workflow 3 used `maxDistance: 50000000` and `$limit: 1`; no clinic had a nurse within 5 km. `MedicalCatalogs` was never seeded.

## 3. Changes made and why
**Mine (`a2-fixes`):**
- `sql/01`–`03`: status renamed `IN_CONSULTATION` to match the assignment's index; `RESTRICT` foreign keys; CHECK / NOT NULL rules; append-only audit triggers; a trigger allowing only WAITING → IN_CONSULTATION → DISCHARGED.
- `sql/04`–`06`: the procedure validates input, rounds the copay and checks the clinic; UTC month buckets and a working refresh function; Workflow 2 filters `DISCHARGED` and 30 days with a 7-day `RANGE` window.
- `mongo/01`–`03` and seeders: validators, a rating index, a 5 km Workflow 3 with one result per nurse, re-runnable seeders, seeded catalogs, clinics inside the ping area.

After these, 102/102 SQL, 12/12 concurrency and 39/40 MongoDB tests pass. The remaining check expects all five ratings even when one has no reviews; the API code fills missing ones with 0.

**Teammates:** `sql/07` adds session, retry-key and refresh-time tables; `sql/08` is a read-only Workflow 2 variant without the 30-day cap (`sql/06` stays as reference); Mongo definitions moved to `mongo/schema.json`; seeders now generate India-only data, and the database is named `careconnect_a2`.

## 4. Remaining issues and suggestions
- **Unverified:** my suites, my API checks, and the team's own tests (their note reports 36 backend, 21 frontend and 34 browser tests).
- On the earlier build, 238 of 243 API checks passed. The two real failures: a copay with non-ASCII digits was accepted, and a NUL character in a search box returned HTTP 500.
- The README says the audit trail lists newest entries first; the earlier build showed oldest first.
- The README's `EXPLAIN` excerpts are dated 3 September, before my Workflow 2 change, and not re-captured. I have not compared `schema.json`'s validators with mine.

**Suggestions for the original authors:** run every README step on a clean machine; keep README and code in agreement; keep rules in the database (CHECK, validators, triggers); commit dated `EXPLAIN` output and redo it after query changes; add the test suites to the repo.
