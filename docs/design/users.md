# Users and design decisions

Patients browse clinics, check their HSA, book one active appointment, inspect their immutable audit trail, find nearby active nurses, and read global review insights and flexible medical catalogs.

Clinic staff inspect appointments belonging to their clinic, move visits from WAITING to IN_CONSULTATION to DISCHARGED, and refresh the discharge summary. In explicitly enabled local demo mode, all seeded patients/clinics are permitted actor choices. A staff session retains the previously selected demo patient as its explicit audit context.

There are exactly six routes: Browse, Transaction, Audit trail, Analytics, Map and Reviews. Record details open inline inside Browse. The header contains actor and clinic controls. Booking from Browse carries the clinic into Transaction. Styling stays inside JSX; colors remain centralized in `web/src/colors.js`. Material icons, common cards, tables, forms and buttons are reused. Reviews uses independent content panels to avoid a browser scrollbar.

The original six SVG wireframes are retained in `CareConnect_Six_Screens/svg/`. They use illustrative values, not API fixtures or live records.


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
