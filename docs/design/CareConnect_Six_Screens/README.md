# CareConnect - exactly six screen designs

Design-only handoff. No application code, database records or project ZIP were changed. The six SVGs are editable vector mockups, not executable application screens. Sample names, IDs, amounts, timestamps and graphs exist only in these design assets.

## Files and count

The `svg/` folder contains exactly six artboards:

1. `01_browse.svg` - Patients, Clinics and Appointments tabs; bounded browsing, search/filter and details on the same artboard.
2. `02_transaction.svg` - booking form, before/after balance, exact audit entry and inline outcome layers.
3. `03_audit_trail.svg` - chosen patient, date filters, opening/current balance and immutable running ledger.
4. `04_analytics.svg` - moving-average chart, dated DENSE_RANK table, materialized-view discharge count and refresh control.
5. `05_map.svg` - selectable origin, 5 km circle, distance-ordered nurses and live-poll status.
6. `06_reviews.svg` - three review facets and flexible MedicalCatalogs content inside this screen.

There is no separate dashboard, detail, catalog, actor-selection, login or More screen. The companion PDF has exactly six pages, one per screen, without a cover page. Browse tabs, failure states and loading/empty/error layers reuse their existing artboard; they are not extra pages or navigation destinations.

## Visual reference

The two supplied images determine the visual direction: white header, two inline selectors, horizontal six-item navigation, teal underline/primary actions, pale background, rounded white panels, subtle borders, dark green type, mint highlights and restrained success/error colours. The generated designs retain that organisation instead of introducing a sidebar.

Tokens: primary #117C76; text #173C3A; muted #607B79; background #F3F8F7; border #D8E5E3; mint #E1F3F0; success #DBFBE6; error #A82E2E / #FDE9E7. Cards use 14 px corners; fields/actions use 9 px corners; desktop content has 88 px outer margins. SVG text stays editable, using Arial/DejaVu Sans rather than text outlines.

## Editable variants on the same screens

Open SVGs in Inkscape and use the Layers panel. For mutually exclusive entity/outcome variants, hide the default layer before enabling another:

- Browse: `Browse / clinics` (default), `/ patients`, `/ appointments`. The appointment variant shows forward staff status controls in the detail panel; the header changes to clinic-staff demo context. On the Patients variant, the generic Filter control may be omitted; name/ID search and pagination remain.
- Transaction: `Transaction / success` (default), `/ low-balance`, `/ active-visit`, `/ invalid-copay`, `/ request-failed`, `/ submitting`, `/ no accepting clinics`. Turn off the success layer before viewing other outcomes, including submitting/empty.
- Analytics: `Analytics / refresh failed` is an overlay that preserves previous results and the previous timestamp.
- Browse, Audit Trail, Analytics, Map and Reviews include named loading, empty and error overlays. For Browse's overlays, use the default Clinics entity layer underneath.
- Reviews has independent `Reviews / catalog loading`, `/ catalog empty`, and `/ catalog error` overlays so valid review insights can remain visible when the catalog fails. Review loading/empty/error overlays affect review insights only.

These layers are design variants. Static SVG/PDF buttons do not execute API calls. For Figma, import the six visible SVG compositions onto exactly six frames. Figma may omit hidden layers during SVG import: switch to the desired layer in Inkscape and reimport/replace the contents of the SAME frame when inspecting that state. Do not create extra top-level screen frames for variants.

## Schema basis - actual a2-fixes branch

Reviewed https://github.com/NirupamaRanjan/23_a1b/tree/a2-fixes at commit `22efe1638f8e2c53314a95d36b9424d7944f3740`. DDL/pipeline files are the authority where the repository README disagrees. Repository scripts were read, not executed.

| Object | Actual fields used in the design |
|---|---|
| patients | SERIAL id; name; DECIMAL(10,2) hsa_balance |
| clinics | SERIAL id; name; latitude; longitude; is_accepting_patients |
| appointments | SERIAL id; INT patient_id/clinic_id; positive copay_amount; status; TIMESTAMPTZ created_at |
| wallet_audit_logs | SERIAL id; INT patient_id; positive amount_changed; DEBIT/CREDIT action_type; balance_after; TIMESTAMPTZ timestamp |
| NursePings | integer nurse_id; boolean is_active; GeoJSON location [longitude, latitude]; BSON date created_at |
| PatientReviews | rating 1-5; bedside_manner_tags array; optional patient_id and created_at in seed examples |
| MedicalCatalogs | ObjectId _id; specialty; availability_slots [{day,start,end}]; medication_details {name,strength,route}; optional created_at and other flexible fields |
| Monthly materialized view | clinic_id; clinic_name; UTC month_year; total_discharges |

Source files: [SQL DDL](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/sql/01_schema_ddl.sql), [triggers](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/sql/03_triggers_and_audit.sql), [procedure](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/sql/04_stored_procedures.sql), [materialized view](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/sql/05_materialized_views.sql), [window query](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/sql/06_window_analytics.sql), [Mongo validators](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/mongo/01_collections_and_indexes.js), [geoNear](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/mongo/02_workflow3_geonear.js), [facet](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/mongo/03_workflow4_facet.js), and [catalog field examples](https://github.com/NirupamaRanjan/23_a1b/blob/a2-fixes/data_generation/mongo_seeder.py).

Important differences from the earlier project/user-story examples:

- IDs are integers, not UUIDs. The mockups show actual integer-style identifiers; no invented PT/CL/APT prefixes are required by the database.
- The supplied branch requires copay > 0 and uses `sp_execute_appointment`, not the earlier `sp_book_appointment`. Zero copay is therefore rejected in this design. The three inputs are patient_id, clinic_id and copay. The form permits at most two decimal places to avoid silent changes from the procedure's rounding.
- The exact status literals in DDL are WAITING, IN_CONSULTATION and DISCHARGED. Human-readable labels are Waiting, In consultation and Discharged. SQL enforces forward changes only.
- The Part A query includes DISCHARGED visits from the recent 30 days and computes a RANGE-based seven-calendar-day window over recorded revenue days. It does NOT insert missing zero-revenue dates. Preserve this interpretation in the chart.
- `rank_by_revenue` is DENSE_RANK partitioned by transaction_date and ordered by moving_avg_7d; it is not a monthly/all-time revenue rank. The table shows ranks for a selected date. When a clinic has no output for that date, show no rank, rather than inventing zero/rank values.
- The monthly view has discharge counts only, not a revenue column. The design labels the separate revenue card as a 30-day query-derived total. Derive that total from daily discharged revenue without summing repeated moving-average values.
- `refresh_clinic_monthly_discharges()` performs the concurrent refresh. A durable last-successful-refresh timestamp is not currently stored by this repository and must be added/tracked server-side during implementation. The mock timestamp is illustrative, not proof the current repository already supports it.
- The review facets are global, with `bedside_manner_tags`; no clinic_id is available for clinic-specific review filtering. The selected clinic in the header does not change the Reviews aggregation scope.
- No nurse name/profile collection exists. Use Nurse <integer ID>; do not invent names. The current pipeline retains the nearest active ping per nurse, NOT the latest ping across all statuses. To fulfil the accepted latest-location story, implementation must fix that selection and explicitly bound freshness before returning results. A newer offline/outside-radius ping must not be replaced by an older active location. This is a documented required backend change, not a change made in this phase.
- No currency is specified. Unlike the reference's rupee examples, amounts are labelled as HSA account units to avoid inventing INR.

## Step 3 coverage

| Requirement | Where it appears |
|---|---|
| Browse the P4 entities, search/filter, bounded pages, record detail | Three tabs, search/filter fields, Previous/Next and inline detail panel in Browse |
| Workflow 1 procedure form, before/after balance, friendly low-balance/active-visit error, trigger audit | Transaction form, success result/audit row, named error layers |
| Read-only wallet_audit_logs for a chosen patient, date filter, running balance | Audit Trail selector/date range, append-only ledger and balance_after column |
| Workflow 2 moving average and DENSE_RANK | Analytics chart and date-specific ranked table |
| Materialized-view summary, last refreshed and refresh button | Monthly discharge card and refresh card in Analytics; timestamp integration gap documented |
| Workflow 3 selectable origin, 5 km, distance-ordered results and polling | Map origin fields/buttons, circle, numbered markers/list and ten-second refresh indicator |
| Workflow 4 rating distribution, top tags, average and flexible catalog | Reviews summary/charts and Medical catalog panel |
| Actor switching without another page | Inline demo-role/actor and selected-clinic header selectors |
| Forward status progression for partial-index demonstration | Browse > Appointments > inline staff controls |
| Loading, empty and failure behaviour | Named same-artboard overlays and outcome layers |
| Laptop/phone usability | Same six screens, with the responsive rules below |

## Phone behaviour - same six screens

No extra mobile screen assets are added. At <= 768 px, use 16 px outer margins, 44 px minimum touch targets, stacked header selectors and horizontally scrollable six-item navigation (no More page). All labels remain visible; content scrolls vertically.

- Browse: tabs stay at the top; the current page becomes labelled record cards. Its selected-record detail appears below the selected card, inside Browse. Pagination remains below that page.
- Transaction: booking form first, inline result second; before/after amounts stack. The audit record becomes labelled fields rather than a clipped five-column table.
- Audit: patient/date fields and summary cards stack. Ledger rows become labelled read-only records with timestamp/action/amount/balance, preserving chronology.
- Analytics: summary cards stack, chart keeps legible axes and minimum height, rank rows become cards or an internally scrollable labelled table. Refresh stays beside its freshness status.
- Map: origin controls stack, then a full-width map (minimum 320 px height), then the distance-ordered list. Keep origin and radius visible.
- Reviews: overall summary, charts and catalog stack. Availability slots/medication details use labelled rows; nested fields wrap and expand within this screen.

Keyboard focus must be visible. Link/button names must be meaningful, selected tabs expose their selection state, chart data have accessible text/table equivalents within the same panels, and important outcome messages are announced without relying on colour alone.

## Data and state rules

Never fill an empty connected database with mock records. Browse lists, actor choices, maps, ledgers, chart values and catalogs must come from bounded API responses. Retain selected IDs on navigation; refetch balances after a confirmed booking. Disable duplicate submits while a request is pending. Keep a durable retry key across an uncertain request; never show an invented rollback/success when the outcome is unknown.

Capture the generated appointment and exact trigger audit row in the same transaction while holding the patient lock. Do not query an arbitrary latest row after the lock/transaction is released. The existing procedure returns no output IDs, so the API must capture those records transaction-safely or a documented procedure change must expose them. This phase implements neither approach.

On status conflict, refetch and explain that another staff member changed the visit. Refresh failure retains the previous materialized-view data and unchanged timestamp. Map polling pauses or avoids unnecessary background work; failure labels retained data as stale. Reviews and catalog handle failures independently. Read-only audit UI has no edit/delete controls, and the database append-only triggers remain active.

See SECURITY.md for required implementation controls. These mockups are not a security audit or a working secured application.
