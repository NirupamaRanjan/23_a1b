# Database setup and medical_db migration

## Ownership and names

The MongoDB **database** is `medical_db`. Its four collections are `Nurses`, `NursePings`,
`PatientReviews` and `MedicalCatalogs`; they are not merged or renamed to `medical_db`.
The PostgreSQL database keeps the name in your `DATABASE_URL` (including `postgres` if that is
where your assignment tables already exist). The repository folder and Docker project may
still be called careconnect; those names do not determine the MongoDB database.

| Root path | Responsibility |
|---|---|
| `sql/` | PostgreSQL DDL, indexes, triggers, procedures, views and API support SQL |
| `mongo/schema.json` | Single authoritative MongoDB collection validators and indexes |
| `mongo/setup.py` | Idempotent Python schema installer and read-only `--check` |
| `mongo/01_collections_and_indexes.js` | Optional mongosh installer reading the same JSON |
| `mongo/04_api_indexes.js` | Compatibility entry point delegating to 01, without separate definitions |
| `data_generation/bootstrap.py` | Coordinates root SQL/Mongo setup and seeds only empty stores |
| `data_generation/*_seeder.py` | Sample records; the Mongo seeder requires `--reset-data` to replace populated data |
| `data_generation/fresh_pings.py` | Demo telemetry generator using the nurse directory |
| `api/` | Request handling and database access; old scripts are small compatibility launchers |

The duplicate `api/app/mongo_setup.py` has been removed. Neither normal API requests nor frontend
startup create database schemas. Docker seed and manual bootstrap run the same Python setup.
All collection definitions are loaded from `mongo/schema.json`; there is no second index list.

## Update an existing Windows installation

Stop the API and frontend. Extract this complete release into a new folder. Preserve your
PostgreSQL credentials and MongoDB URI in your existing active root `.env` (or legacy `api/.env`).
Change only the MongoDB database setting to:

```dotenv
CARECONNECT_MONGO_DB=medical_db
```

An exported environment variable overrides `.env`. Clear a conflicting PowerShell value:

```powershell
Remove-Item Env:CARECONNECT_MONGO_DB -ErrorAction SilentlyContinue
```

From the project root, using your Python virtual environment:

```powershell
python mongo/setup.py
python mongo/setup.py --check
python data_generation/bootstrap.py
```

The first two commands do not insert or delete documents. Bootstrap seeds only when all known
Mongo collections are empty, and preserves partially populated stores. It also installs the root
SQL/API additions using your existing PostgreSQL connection. Restart the API after changing `.env`.

Existing data in a differently named Mongo database is not automatically renamed, copied or
removed. If the intended records are there, export/import them into `medical_db` before normal
use. A fresh `medical_db` otherwise receives sample records during bootstrap. Do not rerun an
older seeder to repair indexes: run `mongo/setup.py` instead.

The schema installer updates validators for future inserts/updates; it does not retroactively
clean existing documents. Index option conflicts or invalid geospatial records are reported,
not silently dropped or overwritten. Correct the identified record/index conflict before retrying.

## Map failure diagnostics

An `OperationFailure` alone did not establish the original cause of the user's failed request.
The previous handler hid all such errors as `MONGO_UNAVAILABLE`. The new handler logs the numeric
MongoDB server code and returns a specific safe category:

| Code | Meaning |
|---|---|
| `MONGO_SETUP_INCOMPLETE` | Required map namespace/index setup is missing |
| `MONGO_PERMISSION_DENIED` | The database account lacks the requested permission |
| `MONGO_AUTH_FAILED` | MongoDB authentication failed |
| `MONGO_VERSION_UNSUPPORTED` | Unsupported query operator/stage |
| `MONGO_QUERY_FAILED` | Another MongoDB command/query failure; inspect the numeric server code |
| `MONGO_UNAVAILABLE` | Driver connection/server selection failure |
| `DATABASE_TIMEOUT` | Operation/network timeout |

The nurse query explicitly uses the geospatial `location` field and uses sort/group/lookup for
latest-ping correctness without the newer `$top` accumulator. Keep MongoDB 7+ as the supported
runtime. Missing indexes and multiple geospatial indexes have real database regression checks.
A successful search with no active, fresh nurses within 5 km returns 200 with an empty list.

`python scripts/check-config.py --connect` tests database connections.
`python scripts/check-config.py --schema` additionally checks MongoDB schema/index requirements.
The Mongo-only check is `python mongo/setup.py --check` and does not require PostgreSQL.

Pings expire after two hours. To add current demo pings using existing nurse homes:

```powershell
python data_generation/fresh_pings.py --loop 30
```

No nurse data is invented by the frontend. A location outside the seeded service area can
legitimately have no nearby nurses.

## Docker

Docker uses MongoDB database `medical_db` internally. It builds the API image with root `mongo/`,
`sql/` and `data_generation/`; its seed service runs `data_generation/bootstrap.py`. The separate
JavaScript mongo-init service has been removed. The health/readiness ordering is retained.
Rebuild the changed images with your existing `.env.docker`:

```powershell
docker compose --env-file .env.docker up -d --build --wait
```

Existing volumes/databases are retained. No volume deletion or automatic old-database migration
is performed. Native Windows and Docker image execution were not available in this environment;
Compose parsing, source checks and the Linux Python/browser/database workflow were verified.
