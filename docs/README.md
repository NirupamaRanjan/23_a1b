# Documentation guide and assignment requirements

The assignment PDF is named `Assignment1b.pdf`, but its title is **Assignment 2: Front End Design**.
Pages 2 and 5 specify the handover, API sketch and design documentation below. Page 4 specifies
setup/tests/demo expectations. This folder preserves the original designs and records the current
implementation and verification separately.

## Required assignment documents

| Location | What it must explain | Current contents |
|---|---|---|
| `handover_note.md` | About one page: inherited system, what worked, what failed/missed, changes and reasons, suggestions for the original authors. | Updated to the current API, map, settings and platform support. |
| `api_endpoints.md` | API endpoint sketch with inputs and outputs for browsing and the four workflows. | Current session, browsing, booking, audit, analytics, map, reviews and catalog contract. |
| `design/users.md` | Main users and what each wants to do; consistent visual choices and reusable components. | Patient/staff goals, six routes, responsive layout and design tokens. |
| `design/CareConnect_Six_Screens/svg/` | Wireframes for the application screens. Any drawing tool is acceptable. | Six editable SVGs from the original design stage, including state variants. |

Wireframes document design before implementation; they are not screenshots of the latest wide layout.
Their sample values and some original design assumptions differ from the implemented seeded app.
The accompanying design README explicitly records those differences.

## Other submission requirements (mainly in the root README)

- Setup steps that a new person can follow, assumptions and brief technology justification.
- Screenshots of the final screens, actual team contributions, the final team repository URL and final
  commit hash. `docs/screenshots/` is a useful convention for images; that exact folder name is not prescribed.
- A reviewed demo of no more than five minutes, linked from the root README. The existing video in
  `demo/` is an earlier automated demonstration, not a fresh recording of the latest wider layout.
- Keep Assignment 1 history in the assigned fork. Name the single Moodle ZIP `<new_team_number>_a1b.zip`,
  strictly under 20 MB, excluding dependencies, virtual environments, caches, build output and dumps.

The current package still needs the team's real contributions, final repository/commit details,
final screenshots and a reviewed current demo before submission. Those cannot be invented.

## Supporting documentation

These files are useful supporting material, rather than additional specifically mandated files:

- `database_setup.md`: current medical_db naming, root-owned setup, upgrade commands and error diagnostics.
- `verification.md`: checks actually executed and platform limits.
- `review_fixes.md`: earlier frontend/API review and Leaflet diagnosis.
- `layout_platform_update.md`: wide layouts, PowerShell scripts, Docker settings/ports and CI.
- `relational_erd.png` and `mongo_schema_map.json`: database reference material.
- `inherited_README.md`: preserved historical source documentation.
- `submission_checklist.md`: final team-owned submission steps.

Current setup commands live in the root `README.md`. Browser security notes are in
`../web/docs/SECURITY.md`; the security document alongside the SVGs is a historical design checklist.
