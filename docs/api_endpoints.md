# FastAPI integration contract for the six React screens

This contract is implemented by the FastAPI server in `api/app/`. The inherited repository supplied the database scripts; the added class-based service layer adapts them without adding UI screens. All paths are under `/api/v1`, proxied on the frontend origin. Responses below describe their fields; numeric IDs are the assigned SERIAL/INT values, decimal money is returned as exact strings, and timestamps are ISO 8601 with UTC offset.

## Session and identity

`GET /session` must return:

```json
{
  "actor": {"role":"patient","id":10482,"name":"Asha Rao"},
  "patient": {"id":10482,"name":"Asha Rao","hsa_balance":"5000.00"},
  "clinic": {"id":217,"name":"Lakeview Family Clinic","latitude":17.445376,"longitude":78.346144,"is_accepting_patients":true},
  "csrf_token":"SESSION_BOUND_RANDOM_TOKEN",
  "demo_mode":false
}
```

This is a contract example, not a runtime fallback. Establish identity/permissions on the server. In patient sessions, `patient` must be that authenticated/authorised patient. In staff sessions it can be an explicitly server-authorised patient context or null. Audit Trail shows this name without a dropdown. Do not accept an arbitrary patient_id from the browser as proof of permission.

The API must validate `X-CSRF-Token` on all POST/PATCH requests, including demo switching and refresh. Cookies are server-managed; session/CSRF tokens are not stored in localStorage/sessionStorage by the client. Real deployments need an identity/session mechanism; the UI adds no separate login screen.

Controlled demo mode only:

- `GET /session/actors?q=&page=1&page_size=5` -> a bounded paged list of permitted `{role,id,name}` actor choices.
- `POST /session/actor` with `{role,actor_id}` -> return a complete updated session with a session-bound CSRF token. Reject this endpoint outside authorised demo mode. Never grant production access merely because the browser posts `role: staff`.

## Paged envelope

All list endpoints return `{items:[...],total:123,pages:25,page:1,page_size:5}`. `total` is the filtered count across all pages, not the count of the current page. Validate page_size against the maximum (100 for relational lists; 5 for catalogs); use parameterised paging/search and a stable secondary ID ordering. Search q is a literal string of at most 120 characters.

## Browse

- `GET /patients?q=&page=&page_size=` -> id, name, hsa_balance. Enforce visibility scope server-side.
- `GET /patients/{id}` -> that patient's authorised details.
- `GET /clinics?q=&accepting=true|false&page=&page_size=` -> id, name, latitude, longitude, is_accepting_patients.
- `GET /clinics/{id}` -> those clinic fields.
- `GET /appointments?q=&status=&page=&page_size=` -> id, patient_id/name, clinic_id/name, copay_amount, status, created_at, and server-computed can_update_status.
- `GET /appointments/{id}` -> the same joined detail fields; enforce actor/clinic scope.
- `PATCH /appointments/{id}/status` with `{status,expected_status}` -> updated row. Authorise staff, lock/check the expected state and permit only WAITING -> IN_CONSULTATION -> DISCHARGED. Keep the inherited status trigger and partial unique index.

The Book at this clinic button stores the fetched clinic object in React context and routes to Transaction. It does not cause a booking by itself.

## Transaction and audit

`POST /appointments` body: `{clinic_id:217,copay_amount:"500.00"}`. Derive patient_id from the trusted server session. Validate positive copay with at most two decimal places and call `sp_execute_appointment(patient_id,clinic_id,copay)` inside a transaction.

Require `Idempotency-Key`: persist the key, actor and request fingerprint/result atomically; identical retries return the same result, changed details with that key return 409. The client persists only the random retry key and a hashed request fingerprint in per-tab sessionStorage, with an in-memory fallback. It never uses that storage as authentication.

Response:

```json
{
  "appointment":{"id":558201,"patient_id":10482,"clinic_id":217,"clinic_name":"Lakeview Family Clinic","copay_amount":"500.00","status":"WAITING","created_at":"2026-10-12T22:31:00Z"},
  "balance_before":"5000.00","balance_after":"4500.00",
  "audit_log":{"id":90417,"patient_id":10482,"amount_changed":"500.00","action_type":"DEBIT","balance_after":"4500.00","timestamp":"2026-10-12T22:31:00Z"}
}
```

The procedure currently returns no generated IDs. Capture the exact appointment/audit in the same locked transaction, or document an output-ID procedure adaptation. Do not select a random/latest audit after releasing the patient lock. Never synthesize a trigger row in application code. Return only after the transaction commits.

`GET /me/audit?start_date=&end_date=&page=&page_size=` must derive the patient from the server session and return the paged envelope plus `current_balance`, `opening_balance` and `has_active_appointment`. Items are id, patient_id, amount_changed, action_type, balance_after, timestamp. Use inclusive UTC date bounds (end date implemented as < next day). Order newest-first by timestamp DESC, id DESC; calculate the opening balance for the entire selected period, not just the page. `total` drives the Number of entries card. No audit edit/delete API is required.

## Analytics

- `GET /analytics/revenue?clinic_id=&start_date=&end_date=` -> `{items:[{transaction_date,daily_total,moving_avg_7d}],total_copay_revenue:"61500.00"}`. Preserve the assigned DISCHARGED-only RANGE-window query; do not silently change it to zero-filled days. The initial view covers the last 30 UTC calendar dates, but any historical range through today is allowed. The API reads sql/08_analytics_history.sql, retaining the seven-day lookback before filtering the visible interval. total_copay_revenue is the sum of the selected clinic's daily totals within the selected dates. The response also includes the effective start_date/end_date. The original assigned 30-day SQL 06 query remains available unchanged for direct reference.
- `GET /analytics/ranking?date=&page=&page_size=` -> paged `{clinic_id,clinic_name,transaction_date,moving_avg_7d,rank_by_revenue}`. Preserve DENSE_RANK partition by transaction_date, ordered by moving_avg_7d. The default UI date is today; an empty date is an honest empty state.
- `GET /analytics/monthly?clinic_id=&month=YYYY-MM-01` -> `{total_discharges:214,last_refreshed_at:ISO8601|null}` for the supplied monthly discharge view.
- `POST /analytics/monthly/refresh` -> last successful refresh metadata. Authorise staff; use `refresh_clinic_monthly_discharges()` concurrently and keep a durable successful timestamp consistent with the refreshed snapshot. The source repo does not already store this timestamp. Never use the browser clock as a fake refresh time.

## Map

`GET /nurses/nearby?latitude=&longitude=&limit=10` -> `{updated_at:ISO8601,items:[{nurse_id,nurse_name?,is_active,location:{type:"Point",coordinates:[lng,lat]},created_at:ISO8601,dist:{calculated:480}}]}`. `dist.calculated` is metres. Enforce 5,000 m radius and a bounded limit server-side, return sorted by distance, and do not accept arbitrary client pipelines/operators.

To meet the accepted current-location semantics, select each nurse's latest ping across statuses and locations before treating it as active/nearby; don't retain an old inside-radius ping when a newer offline/outside-radius ping exists. Explicitly enforce the two-hour freshness bound because TTL deletion is asynchronous. Document this correction to the branch's nearest-ping grouping. API updated_at is response freshness, while each created_at is the actual ping time. The client polls while visible and labels retained results stale when a refresh fails.

## Reviews and catalog

- `GET /reviews/insights` -> `{total_reviews:500,avg_rating:4.2,rating_distribution:[{rating:5,count:250}],frequent_tags:[{tag:"Friendly",count:330}]}`. Adapt the assigned $facet output names (`overall_summary`, `rating_distribution`, `frequent_tags`) and `_id` keys to this transport shape. Global PatientReviews, with `bedside_manner_tags`, has no guaranteed clinic_id. Do not pretend the selected clinic scopes these charts. Return missing rating buckets as zero; top tags remain bounded by the pipeline's ten-tag limit.
- `GET /catalogs?q=&specialty=&page=&page_size=1` -> paged full MedicalCatalogs document, `id` equal to stringified Mongo _id, specialty, availability_slots, medication_details and arbitrary extra JSON-compatible fields. Serialise BSON dates/ObjectId safely and cap response size/depth. One document is fetched per page; `q` searches specialty text and `specialty` filters by exact specialty. `GET /catalogs/specialties` -> `{items:[{specialty,count}]}` for the specialty chips. No catalog edit endpoint is needed.

## Safe failures

Non-2xx responses use `{code: "INSUFFICIENT_HSA_BALANCE"}` or another safe public code. The client intentionally ignores arbitrary server message strings. Supported codes include ACTIVE_VISIT_EXISTS, CLINIC_NOT_ACCEPTING, INVALID_COPAY, STATUS_CONFLICT, INVALID_STATUS_TRANSITION, CSRF_FAILED, SESSION_EXPIRED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, REFRESH_IN_PROGRESS and REQUEST_KEY_CONFLICT. Never return SQL text, stack traces, secrets or another patient's details. Unexpected/network/5xx booking errors remain uncertain; the client retries the original details with the original key rather than claiming an unverified rollback.

## MongoDB setup and command failures

Runtime reads use the `medical_db` database. Schema repair is an administrator command from
root `mongo/setup.py`; normal API requests never install schema. MongoDB operation errors now
return `MONGO_SETUP_INCOMPLETE`, `MONGO_PERMISSION_DENIED`, `MONGO_AUTH_FAILED`, or
`MONGO_VERSION_UNSUPPORTED` with 503; other command failures return `MONGO_QUERY_FAILED` with
500. Connectivity returns `MONGO_UNAVAILABLE` (503); execution/network timeouts remain
`DATABASE_TIMEOUT` (503). Raw driver/server messages are not returned in JSON.


## UI defaults and Indian demo locations

Map obtains the current device coordinates through browser geolocation (permission required,
HTTPS or localhost), then passes the returned origin to the existing nearby endpoint. Permission
failure does not silently display a clinic as the user's location. Manual origin and an explicitly
selected clinic remain available. The endpoint reads only NursePings and accepts active/name as
aliases for is_active/nurse_name; canonical fields take precedence.

Audit initializes explicit start_date/end_date for the last 30 UTC calendar dates including today.
Only applied ranges are saved, separately per patient in per-tab sessionStorage. Returning to the
screen or reloading restores the range. Reset restores 30 days. The latest current_balance is not
a historical closing balance. Analytics also initializes a populated explicit 30-calendar-date range;
the selected-period revenue card sums the exact displayed daily revenue rows.

Generation is constrained to 20 km inland service circles around Hyderabad and selected cities
in Telangana, Andhra Pradesh, Karnataka and Maharashtra. Geographic defaults, clinic seeds,
nurse homes, movements and emitted ping checks share data_generation/india_geography.py.
No database objects or endpoints are added for this geography or UI state.
