# CareConnect handover note

## Sources and scope

Inherited repository: https://github.com/NirupamaRanjan/23_a1b/tree/a2-fixes, commit `22efe1638f8e2c53314a95d36b9424d7944f3740`. The existing frontend is the user's `CareConnect_React_Six_Screens.zip`; its six React routes and API client are retained. The supplied PDF is titled Assignment 2 despite its filename Assignment1b.pdf. The style reference is https://github.com/niral261/spotify2MP3, commit `962bba375ae182822b839d561c875f5c0135878d`.

## What worked

The relational schema, partial active-appointment unique index, positive copay/nonnegative HSA checks, audit trigger, append-only audit guards and monotonic appointment status trigger are coherent. The procedure locks the patient before debiting and inserts WAITING appointments atomically. Its failed unique-index insert rolls back both the debit and trigger row. The calendar RANGE analytics query and DENSE_RANK return ties correctly. The materialized view has the unique index required for concurrent refresh. MongoDB provides validators, a 2dsphere index, two-hour TTL, review facet and flexible catalogs. Original Part A scripts and seeders are retained.

## Gaps and changes

The inherited repository contains no web or HTTP API; the recovered frontend describes a contract rather than supplying a backend. We added a thin FastAPI adapter with class-based services, a bounded PostgreSQL connection pool, PyMongo, safe public failures, trusted server sessions, CSRF verification, parameterized SQL, literal search and stable pagination. Booking captures the exact trigger row while holding the patient lock. Additive `sql/07_api_support.sql` persists opaque sessions, booking idempotency results and real refresh timestamps, and adds browsing/audit indexes. No Part A table, stored procedure or existing trigger was rewritten. Analytics executes `sql/06_window_analytics.sql` rather than implementing window functions in Python.

The original geo pipeline keeps the nearest historical ping per nurse; that can show a nurse who has since gone offline or left the radius. The API retains $geoNear and the 5 km index-based candidate search, selects the latest nearby candidate, then uses $lookup to verify that it is the nurse's latest ping across all locations/statuses. It enforces freshness explicitly while TTL deletion catches up. Additive `mongo/04_api_indexes.js` supports this check. The assigned standalone workflow files remain unchanged for comparison.

The README describes `IN CONSULTATION`, but the actual branch uses `IN_CONSULTATION`; the API follows the executable DDL. Mongo seeding already replaces collections and relational seeding already disables ledger guards for a privileged reset, despite outdated inherited README claims. Bootstrap runs these destructive seeders only when the respective store is empty; it does not reseed an existing store. Fresh-ping tooling appends telemetry without resetting reviews/catalogs.

## Suggestions

Keep documentation literals synchronized with DDL; make script return shapes explicit; add generated-ID outputs to the procedure if a future API requires them; document that the 7-day average uses only recorded revenue days; separate development reset tools from application credentials; retain current-ping semantics in future telemetry changes. The demo uses explicit local actor switching, not production authentication. Full production identity integration is outside the assignment.

A live-browser check also found that React StrictMode could race two initial session requests. The API client now shares an in-flight session request; a regression test protects cookie/CSRF alignment while preserving the six-screen UI.
