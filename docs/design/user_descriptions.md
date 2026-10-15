# Users and design decisions

Patients browse clinics, check their HSA, book one active appointment, inspect their immutable audit trail, find nearby active nurses, and read global review insights and flexible medical catalogs.

Clinic staff inspect appointments belonging to their clinic, move visits from WAITING to IN_CONSULTATION to DISCHARGED, and refresh the discharge summary. In explicitly enabled local demo mode, all seeded patients/clinics are permitted actor choices. A staff session retains the previously selected demo patient as its explicit audit context.

There are exactly six routes: Browse, Transaction, Audit trail, Analytics, Map and Reviews. Record details open inline inside Browse. The header contains actor and clinic controls. Booking from Browse carries the clinic into Transaction. Styling stays inside JSX; colors remain centralized in `web/src/colors.js`. Material icons, common cards, tables, forms and buttons are reused. Reviews uses independent content panels to avoid a browser scrollbar.

The original six SVG wireframes are retained in `wireframes/`. They use illustrative values, not API fixtures or live records.


## Current look and responsive layout

The palette is centralized in `web/src/colors.js`: teal primary (`#117C76`), dark green text
(`#173C3A`), pale background (`#F3F8F7`) and white surfaces. Locally bundled Inter/sans-serif, shared cards,
buttons, forms, tables and status chips are reused across screens. Styling remains in JSX/MUI.

The shared workspace fills the available width with 16–24 px responsive side gutters. Map/chart
areas grow on larger displays. On phones, multi-column panels stack; Reviews switches between
Overview, Charts and Catalog tabs and scrolls within panels. The original SVG wireframes retain
their earlier fixed artboard proportions; they are the design-stage record, not current screenshots.

The Medical catalog uses 16–18 px desktop text, larger availability-table rows and grouped
medication/availability sections. Shorter screens retain internal scrolling instead of compressing
field values. This content is read from `medical_db.MedicalCatalogs`, not frontend fixture data.


## Location, date filters and empty results

Map requests the device's current position on entry. Browser permission is required; permission
denial, timeout or unsupported geolocation leaves an explicit manual/clinic selection. Clinic
changes do not silently replace a device/manual origin. The search stays 5 km, active and latest,
with a two-hour ping limit. Synthetic data is clustered in inland Indian service areas and does not
promise coverage everywhere in India or at every real device location.

Audit starts with the last 30 calendar days including today, UTC. The last applied dates are kept
per patient in tab session storage and restored on navigation/reload; unsubmitted edits do not
change results. Last 30 days resets the filter. The Current HSA balance always means the latest
saved balance, independent of date filters; opening balance and entry count are period-specific.
Analytics initially sends an explicit last-30-calendar-date interval; date fields and chart query
agree. Historical chart/ranking dates are selectable without a 30-day lower bound. The revenue card sums the selected chart period; monthly discharges still follow the separate month picker.

All six screens use a shared teal clipboard/search illustration for empty results or unselected
context, with a useful explanation and relevant actions. Empty, loading and failed requests are
separate states. The illustration is local SVG/JSX and needs no external asset service.
