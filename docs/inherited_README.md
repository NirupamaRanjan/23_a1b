# CareConnect - On-Demand Telemedicine Database System

Project 4 for CS6.302 Assignment 1. The repository contains a reproducible PostgreSQL and MongoDB implementation of the required database workflows.

## Submission metadata

> **Required before submission:** replace both placeholders after pushing the final version.

- GitHub repository URL: https://github.com/shaifalivashistha/2026204018_a1.git
- Final commit hash: 65254eb4d690f9fe89c947f9360a71b4510578d8

## Assumptions

- PostgreSQL and MongoDB run locally on their default ports.
- Appointment statuses use the PDF literals `WAITING`, `IN CONSULTATION`, and `DISCHARGED`.
- Only `DISCHARGED` appointments count as realized copay revenue and monthly discharges.
- Workflow 2 reports the most recent 30 days, which supplies enough history for each 7-day moving average while allowing the analytics index to bound the scan.
- GeoJSON coordinates are ordered as `[longitude, latitude]`, and MongoDB distances are expressed in metres.
- Nurse pings expire two hours after `created_at`; reseed shortly before a live demonstration because an older dataset will correctly become empty.
- The PostgreSQL seeder truncates existing CareConnect relational data. The MongoDB seeder appends data unless the collections are cleared manually.

## Repository map

- `docs/relational_erd.png`: PostgreSQL ERD matching the submitted DDL.
- `docs/mongo_schema_map.json`: MongoDB document structures.
- `sql/01_schema_ddl.sql`: tables, keys, status checks, and non-negative HSA constraint.
- `sql/02_indexes.sql`: active-consultation partial unique index and Workflow 2 covering partial index.
- `sql/03_triggers_and_audit.sql`: automatic HSA audit trigger.
- `sql/04_stored_procedures.sql`: atomic appointment procedure.
- `sql/05_materialized_views.sql`: monthly discharge view, unique index, and concurrent refresh function.
- `sql/06_window_analytics.sql`: CTEs, 7-day moving average, and `DENSE_RANK()`.
- `mongo/01_collections_and_indexes.js`: collection validators, 2dsphere, TTL, and review-rating indexes.
- `mongo/02_workflow3_geonear.js`: nearest active nurse within 5 km.
- `mongo/03_workflow4_facet.js`: rating distribution, frequent tags, and global average.

## Setup and execution

Install the Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r data_generation/requirements.txt
```

Create and configure PostgreSQL. Set the password variable only if the server requires password authentication:

```bash
export CARECONNECT_DB_NAME=careconnect
export CARECONNECT_DB_USER=postgres
export CARECONNECT_DB_PASSWORD='<your-local-postgres-password>'
export PGPASSWORD="$CARECONNECT_DB_PASSWORD"
createdb -h localhost -U postgres careconnect

psql -h localhost -U postgres -d careconnect -v ON_ERROR_STOP=1 -f sql/01_schema_ddl.sql
psql -h localhost -U postgres -d careconnect -v ON_ERROR_STOP=1 -f sql/02_indexes.sql
psql -h localhost -U postgres -d careconnect -v ON_ERROR_STOP=1 -f sql/03_triggers_and_audit.sql
psql -h localhost -U postgres -d careconnect -v ON_ERROR_STOP=1 -f sql/04_stored_procedures.sql
psql -h localhost -U postgres -d careconnect -v ON_ERROR_STOP=1 -f sql/05_materialized_views.sql
python3 data_generation/postgres_seeder.py
psql -h localhost -U postgres -d careconnect -c 'SELECT refresh_clinic_monthly_discharges();'
psql -h localhost -U postgres -d careconnect -f sql/06_window_analytics.sql
```

Create, validate, and seed MongoDB, then run both workflows:

```bash
export CARECONNECT_MONGO_URI='mongodb://localhost:27017/'
export CARECONNECT_MONGO_DB=careconnect

mongosh "$CARECONNECT_MONGO_URI" mongo/01_collections_and_indexes.js
python3 data_generation/mongo_seeder.py
mongosh "$CARECONNECT_MONGO_URI" mongo/02_workflow3_geonear.js
mongosh "$CARECONNECT_MONGO_URI" mongo/03_workflow4_facet.js
```

Example atomic appointment call:

```sql
CALL sp_execute_appointment(1, 1, 25.00);
```

## Stress-test results

The clean-install seeders were executed successfully in disposable databases on 3 September 2026:

| Store | Generated data | Verified count |
|---|---:|---:|
| PostgreSQL `appointments` | 50,000 | 50,000 |
| PostgreSQL `wallet_audit_logs` | 100,000 trigger-generated rows | 100,000 |
| MongoDB `NursePings` | 500,000 | 500,000 before TTL expiry |
| MongoDB `PatientReviews` | 5,000 | 5,000 |

## Performance proof

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