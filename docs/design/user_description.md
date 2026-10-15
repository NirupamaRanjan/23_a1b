# Users and design decisions

## Who uses CareConnect

### Patient

A person with a Health Savings Account (HSA) who wants care quickly and needs to trust what they are charged.

| Goal | Where |
|---|---|
| Find a clinic that is accepting patients and see where it is | Browse → Clinics (filter "Accepting") |
| Book an appointment and pay the copay from the HSA, seeing the balance before and after | Browse → **Book at this clinic** → Transaction |
| Check every change to the HSA balance, with dates and the running balance | Audit trail |
| Find an active nurse near their current location | Map |
| Read what other patients think and look up specialties, physicians and medicines | Reviews |
| See their own visits and their status | Browse → Appointments |

A patient sees only their own patient record and appointments. They cannot change appointment statuses or
refresh analytics.

### Clinic staff

Reception or admin staff of **one** clinic who manage the day's visits and follow the clinic's revenue.

| Goal | Where |
|---|---|
| See the clinic's appointments, newest first, and search or filter them by status | Browse → Appointments |
| Move a visit from Waiting → In consultation → Discharged | Browse → appointment details |
| Follow daily revenue, the 7-day moving average and how the clinic ranks against others | Analytics |
| Update the monthly discharge summary and see when it was last refreshed | Analytics → **Refresh summary** |
| Look up nurses near the clinic | Map → **Use selected clinic** |

Clinic staff cannot book appointments or read a patient's HSA ledger: Transaction and Audit trail show
"Clinic staff cannot …" with a **Go to Browse** button, and the API refuses those requests.

In the demo there is no login; the header's **Acting as** control switches between any seeded patient and any
clinic's staff, and **Selected clinic** chooses the clinic used by Transaction, Analytics and the Map.

## Screens and navigation

- Exactly six screens, always reachable from the top navigation: **Browse, Transaction, Audit trail,
  Analytics, Map, Reviews**. Details open inline (Browse's right-hand panel) instead of on extra pages.
- One header on every screen: logo, **Acting as** and **Selected clinic**.
- **Book at this clinic** in Browse carries the clinic into Transaction; it never books by itself.
- Every screen starts with a page title and a one-line explanation, followed by cards or panels.

## Visual design

- **Colour:** one teal primary (`#117C76`) for actions, the active tab, charts and highlights; dark green-grey
  text (`#173C3A`); a pale green-grey page background (`#F3F8F7`) with white cards. Red is used only for
  debits and errors. All colours are defined once in `web/src/colors.js`.
- **Type:** Inter (bundled locally), clear size steps: page title, panel title, body, small captions.
- **Reusable components:** cards/panels with a thin border, summary cards with one large number, tables with
  a tinted header row, status chips (Waiting, In consultation, Discharged), primary and outlined buttons, a
  pager ("Page 1 of 10 · 50 records") and one shared empty-state illustration.
- **Numbers:** money always has two decimals and a thousands separator; all dates and times are UTC and
  labelled "(UTC)"; distances are shown in km with two decimals.

## States every screen handles

| State | Design |
|---|---|
| Loading | Progress bar with "Loading…" inside the panel that is loading |
| Empty | Shared clipboard illustration, a title, a short explanation and a useful action (Clear filters, Show latest 30 days, Use latest recorded date, Refresh results, Show all specialties) |
| Error | Red message in plain words (never raw server text) with **Retry** |
| API not running | "Could not reach the CareConnect API. Check that it is running…" with **Refresh session** |
| Not allowed | Clinic staff on Transaction or Audit trail see an access message and **Go to Browse** |
| Older data | Analytics and Audit trail open on the latest recorded dates and say so in a note |

## Screen-specific decisions

- **Transaction:** the result shows the exact appointment and the audit row written by the database
  trigger, so the user can see the charge was recorded. Friendly messages for an insufficient balance, a
  visit already open and a clinic not accepting patients.
- **Audit trail:** opens on the last 30 days; dates must be applied with **Apply dates** and are remembered
  per patient. *Current HSA balance* is always the latest balance; *Opening balance* and *Number of entries*
  follow the selected period.
- **Analytics:** the moving average is a 7-calendar-day window; days without revenue are skipped, not drawn
  as zero. Exact values are available in a table under the chart for accessibility.
- **Map:** asks for the device location (browser permission, HTTPS or localhost); typed coordinates, a map
  click or the selected clinic are alternatives. The 5 km radius is drawn on the map and results refresh
  every 10 seconds.
- **Reviews:** fits the browser window without a page scrollbar; the catalog shows one document at a time
  with readable field names and lists any extra fields, because catalog documents are flexible.

## Responsive layout

The workspace uses the full browser width with 16–24 px side margins. Multi-column panels stack on narrow
screens; tables scroll horizontally inside their panel; on phones the Reviews screen becomes three tabs
(Overview, Charts, Catalog). Layouts were checked from 320 px to 2560 px wide.
