# CareConnect API endpoints

The FastAPI server in `api/app/` serves every endpoint under **`/api/v1`** (plus `GET /api/health`).
The React app calls them on its own origin: the Vite dev server (or Nginx in Docker) forwards `/api`
to the API. Interactive documentation is generated at **http://127.0.0.1:8000/api/docs**.

**Conventions**

- **Identity:** every endpoint except `/api/health` needs the session cookie `careconnect_session`
  (HttpOnly, SameSite=Strict), created by `GET /session`. The patient or clinic is always taken from
  the server-side session, never from a browser-supplied ID.
- **Changes** (`POST`, `PATCH`) also need the header `X-CSRF-Token: <csrf_token from /session>` and an
  allowed `Origin`; otherwise `403 CSRF_FAILED`.
- **Money** is an exact decimal string with two places (`"500.00"`); **dates** are `YYYY-MM-DD` (UTC);
  **timestamps** are ISO 8601 with a UTC offset; IDs are integers.
- **Lists** return the paged envelope `{items, total, pages, page, page_size}`. `total` counts all pages.
  `page ≥ 1`; `page_size` 1–100 (default 5). `q` is a literal search string of at most 120 characters.
- **Errors** return only a public code, e.g. `{"code": "INSUFFICIENT_HSA_BALANCE"}` (see [Error codes](#error-codes));
  SQL text, stack traces and connection details are never returned.

## Health

| Method & path | Input | Output |
|---|---|---|
| `GET /api/health` | – | `{"status":"ok"}` when PostgreSQL and MongoDB both answer |

## Session and demo actors

| Method & path | Input | Output |
|---|---|---|
| `GET /session` | – | Current session; in demo mode a new patient session is created if none exists (sets the cookie) |
| `GET /session/actors` | `q`, `page`, `page_size` | Paged `{role, id, name}` actors (patients and clinics) – **demo mode only** |
| `POST /session/actor` | `{"role":"patient"\|"staff","actor_id":12}` | New session for that actor (cookie rotated) – **demo mode only** |

`GET /session` response:

```json
{
  "actor":   {"role": "patient", "id": 1, "name": "Pooja Sandal"},
  "patient": {"id": 1, "name": "Pooja Sandal", "hsa_balance": "1331.43"},
  "clinic":  {"id": 1, "name": "Dewan Medical Center", "latitude": 17.4439, "longitude": 78.3535, "is_accepting_patients": true},
  "csrf_token": "random-session-bound-token",
  "demo_mode": true
}
```

For a clinic-staff actor, `actor.role` is `"staff"`, `actor.id` is the clinic ID and `clinic` is that clinic.

## Browse

| Method & path | Input | Output |
|---|---|---|
| `GET /patients` | `q`, `page`, `page_size` | Paged `{id, name, hsa_balance}`. A patient sees only their own record. |
| `GET /patients/{id}` | – | `{id, name, hsa_balance}`; a patient asking for someone else gets `403 OWN_RECORD_ONLY` |
| `GET /clinics` | `q`, `accepting=true\|false`, `page`, `page_size` | Paged `{id, name, latitude, longitude, is_accepting_patients}` |
| `GET /clinics/{id}` | – | The same clinic fields |
| `GET /appointments` | `q`, `status=WAITING\|IN_CONSULTATION\|DISCHARGED`, `page`, `page_size` | Paged appointments (below), newest first. Patients see their own; staff see their clinic's. |
| `GET /appointments/{id}` | – | One appointment in the same scope, else `404 NOT_FOUND` |

Appointment fields: `{id, patient_id, patient_name, clinic_id, clinic_name, copay_amount, status, created_at, can_update_status}`.
`can_update_status` is true only for staff of that clinic while the visit is not discharged.

## Workflow 1 – booking (Transaction screen)

**`POST /appointments`** – patients only.

Headers: `X-CSRF-Token`, `Idempotency-Key: <uuid>` (a retry with the same key and details returns the
original result; the same key with different details returns `409 REQUEST_KEY_CONFLICT`).

Body: `{"clinic_id": 1, "copay_amount": "250.00"}` – positive, at most two decimals.

The API locks the patient, calls `sp_execute_appointment(patient_id, clinic_id, copay)` in one
transaction and returns the rows the procedure and trigger wrote. `201 Created`:

```json
{
  "appointment": {"id": 50001, "patient_id": 1, "patient_name": "Pooja Sandal", "clinic_id": 1,
                  "clinic_name": "Dewan Medical Center", "copay_amount": "250.00", "status": "WAITING",
                  "created_at": "2026-10-15T16:17:02+00:00", "can_update_status": false},
  "balance_before": "1331.43",
  "balance_after": "1081.43",
  "audit_log": {"id": 100001, "patient_id": 1, "amount_changed": "250.00", "action_type": "DEBIT",
                "balance_after": "1081.43", "timestamp": "2026-10-15T16:17:02+00:00"}
}
```

Errors: `INSUFFICIENT_HSA_BALANCE`, `ACTIVE_VISIT_EXISTS` (partial unique index), `CLINIC_NOT_ACCEPTING`,
`CLINIC_NOT_FOUND`, `INVALID_COPAY`, `PATIENT_ONLY` (clinic staff), `REQUEST_KEY_CONFLICT`.

## Appointment status (Browse, clinic staff)

**`PATCH /appointments/{id}/status`** – clinic staff of that appointment's clinic.

Body: `{"status": "IN_CONSULTATION", "expected_status": "WAITING"}`. Only WAITING → IN_CONSULTATION →
DISCHARGED is allowed (also enforced by the `sql/03` trigger). Returns the updated appointment.

Errors: `STAFF_ONLY`, `OTHER_CLINIC` (another clinic's visit), `NOT_FOUND`, `STATUS_CONFLICT` (status changed
since it was loaded), `INVALID_STATUS_TRANSITION`.

## Audit trail

**`GET /me/audit`** – patients only (clinic staff get `403 PATIENT_ONLY`).

Query: `start_date`, `end_date` (inclusive, UTC; both optional), `page`, `page_size`.

```json
{
  "items": [{"id": 100001, "patient_id": 1, "amount_changed": "250.00", "action_type": "DEBIT",
             "balance_after": "1081.43", "timestamp": "2026-10-15T16:17:02+00:00"}],
  "total": 48, "pages": 5, "page": 1, "page_size": 10,
  "current_balance": "1081.43",
  "opening_balance": "1188.09",
  "has_active_appointment": true,
  "latest_entry_date": "2026-10-15"
}
```

Entries are newest first. `opening_balance` is the balance before the first entry of the whole period
(not just the page); `current_balance` is always the latest balance; `latest_entry_date` is the
patient's newest entry regardless of the filter (the screen uses it when the last 30 days are empty).
Errors: `INVALID_DATE_RANGE`, `PATIENT_ONLY`.

## Workflow 2 – analytics

| Method & path | Input | Output |
|---|---|---|
| `GET /analytics/revenue` | `clinic_id` (required), `start_date`, `end_date` (default: last 30 days; not after today) | `{items:[{transaction_date, daily_total, moving_avg_7d}], total_copay_revenue, start_date, end_date}` |
| `GET /analytics/ranking` | `date` (default today; not after today), `page`, `page_size` | Paged `{clinic_id, clinic_name, transaction_date, daily_total, moving_avg_7d, rank_by_revenue}` |
| `GET /analytics/coverage` | `clinic_id` (optional) | `{earliest_date, latest_date, clinic_earliest_date, clinic_latest_date, today}` – first/last dates with discharged revenue (`null` when none) |
| `GET /analytics/monthly` | `clinic_id`, `month=YYYY-MM-01` | `{total_discharges, last_refreshed_at}` from `mv_clinic_monthly_discharges` |
| `POST /analytics/monthly/refresh` | – (CSRF header) | `{last_refreshed_at}` – **clinic staff only** |

- Revenue and ranking run the Part A query (`sql/08_analytics_history.sql`, the all-dates form of
  `sql/06`): DISCHARGED appointments only, a 7-calendar-day `RANGE` window per clinic and `DENSE_RANK()`
  per date. The date filter is applied after the window, so the first days keep their 6-day lookback.
  `total_copay_revenue` is the sum of the daily totals shown.
- The screen calls `coverage` first and opens on the latest recorded dates, so an older database is not
  shown as empty.
- `refresh` runs `refresh_clinic_monthly_discharges()` (`REFRESH MATERIALIZED VIEW CONCURRENTLY`) and stores
  the time in `api_refresh_metadata`.

Errors: `INVALID_DATE_RANGE`, `DATE_OUTSIDE_WINDOW` (future date), `INVALID_MONTH`, `NOT_FOUND` (clinic),
`STAFF_ONLY`, `REFRESH_IN_PROGRESS`.

## Workflow 3 – nearest nurses (Map)

**`GET /nurses/nearby`** – `latitude` (−90…90), `longitude` (−180…180), `limit` (1–50, the screen uses 10).

```json
{
  "updated_at": "2026-10-15T16:18:10+00:00",
  "items": [{"nurse_id": 42, "nurse_name": "Nitesh Sani", "is_active": true,
             "location": {"type": "Point", "coordinates": [78.3441, 17.4537]},
             "created_at": "2026-10-15T16:12:00+00:00", "dist": {"calculated": 190.4}}]
}
```

`$geoNear` on the `NursePings` 2dsphere index with a fixed 5,000 m radius, then each nurse's **latest**
ping is kept only if it is active and less than two hours old. Sorted by distance (`dist.calculated`,
metres). Coordinates are GeoJSON `[longitude, latitude]`.

## Workflow 4 – reviews and catalog

| Method & path | Input | Output |
|---|---|---|
| `GET /reviews/insights` | – | `{total_reviews, avg_rating, rating_distribution:[{rating, count}] (1–5, missing = 0), frequent_tags:[{tag, count}] (top 10)}` from one `$facet` pipeline |
| `GET /catalogs/specialties` | – | `{items:[{specialty, count}]}` for the specialty chips |
| `GET /catalogs` | `specialty` (exact), `q` (specialty text), `page`, `page_size` (1–5, default 1) | Paged MedicalCatalogs documents: `id` (string `_id`), `specialty`, `physician`, `availability_slots`, `medication_details` and any extra fields |

Reviews have no clinic ID, so the charts are global. Catalog documents larger than 256 KB return
`413 DOCUMENT_TOO_LARGE`.

## Error codes

| HTTP | Codes |
|---|---|
| 400 / 422 | `VALIDATION_ERROR`, `INVALID_COPAY`, `INVALID_DATE_RANGE`, `DATE_OUTSIDE_WINDOW`, `INVALID_MONTH` |
| 401 | `SESSION_EXPIRED` |
| 403 | `CSRF_FAILED`, `PATIENT_ONLY`, `STAFF_ONLY`, `OTHER_CLINIC`, `OWN_RECORD_ONLY`, `NO_PATIENT_SELECTED`, `DEMO_MODE_OFF` |
| 404 | `NOT_FOUND`, `CLINIC_NOT_FOUND` |
| 409 | `INSUFFICIENT_HSA_BALANCE`, `ACTIVE_VISIT_EXISTS`, `CLINIC_NOT_ACCEPTING`, `STATUS_CONFLICT`, `INVALID_STATUS_TRANSITION`, `REQUEST_KEY_CONFLICT`, `REFRESH_IN_PROGRESS` |
| 413 | `DOCUMENT_TOO_LARGE`, oversized request body (`VALIDATION_ERROR`) |
| 500 | `DATABASE_ERROR`, `DATABASE_SETUP_INCOMPLETE`, `MONGO_QUERY_FAILED`, `INTERNAL_ERROR` |
| 503 | `POSTGRES_UNAVAILABLE`, `MONGO_UNAVAILABLE`, `DATABASE_TIMEOUT`, `MONGO_SETUP_INCOMPLETE`, `MONGO_AUTH_FAILED`, `MONGO_PERMISSION_DENIED`, `MONGO_VERSION_UNSUPPORTED` |

The frontend (`web/src/service/api.js`) turns each code into a readable message.
