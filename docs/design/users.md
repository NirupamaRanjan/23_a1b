# Users and design decisions

Patients browse clinics, check their HSA, book one active appointment, inspect their immutable audit trail, find nearby active nurses, and read global review insights and flexible medical catalogs.

Clinic staff inspect appointments belonging to their clinic, move visits from WAITING to IN_CONSULTATION to DISCHARGED, and refresh the discharge summary. In explicitly enabled local demo mode, all seeded patients/clinics are permitted actor choices. A staff session retains the previously selected demo patient as its explicit audit context.

There are exactly six routes: Browse, Transaction, Audit trail, Analytics, Map and Reviews. Record details open inline inside Browse. The header contains actor and clinic controls. Booking from Browse carries the clinic into Transaction. Styling stays inside JSX; colors remain centralized in `web/src/colors.js`. Material icons, common cards, tables, forms and buttons are reused. Reviews uses independent content panels to avoid a browser scrollbar.

The original six SVG wireframes are retained in `CareConnect_Six_Screens/svg/`. They use illustrative values, not API fixtures or live records.
