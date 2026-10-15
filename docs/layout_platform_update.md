# Wider layouts and Windows/Docker support

## Layout

The screenshot showed a narrow main workspace centered on a wide monitor. The shared `Main`
component imposed a 1440 px maximum and 64 px internal side padding. That cap is removed for all six
routes. Desktop and tablet gutters are now 24 px; phone gutters are 16 px.
At 1920 px, 1872 px is usable content width. Header, navigation and footer align with the workspace. 

The map grows to a responsive 460–680 px height on desktops. The analytics chart can grow to 440 px.
Reviews uses a responsive chart height and larger desktop catalog-table text while retaining its
single-viewport layout. No browser zoom, CSS scaling, new screens or database data changes are needed.

The current browser checks cover every route at 1440, 1920 and 2560 px, checking actual panel
edges 24 px from both sides, the heading position, loaded Inter font and no horizontal page overflow. Existing tests cover the phone layout and Reviews on five
viewport sizes. Internal fixture screenshots were inspected; they are not packaged as deliverables.

## Typography and applying this release

Inter (Fontsource Variable Inter 5.3.0) replaces Arial throughout the interface, including Material UI controls and Leaflet text.
A 48 KB Latin variable font is served from `web/public/fonts/`, with a local preload and `font-display: swap`.
No external font request is needed. Its SIL Open Font License is bundled as `Inter-OFL.txt`.
The original SVG wireframes remain historical design-stage assets.

If you still see a narrow centered workspace, stop the existing Vite process with Ctrl+C, extract the
new archive into a new folder and launch `scripts/start-web.ps1` from that extracted project.
Retain your existing `.env`. Starting another server while the old one is running is blocked by
`--strictPort`, so stop the old process first. Open the printed URL and hard refresh (Ctrl+Shift+R).
For Docker, rebuild the web image with `docker compose --env-file .env.docker up -d --build web`.

## Chart readability follow-up

The Reviews rating/tag cards previously expanded while their content stayed in tightly packed
20 px rows with 12 px bars. Their internal content is now sized independently of the outer width:
18 px desktop chart headings, 16 px labels/counts, 18 px bars, and evenly distributed rows using the
available plot height. Phone text/bars use 14 px. Long lists retain internal scrolling.
Data, bar proportions and API behavior are unchanged.

## Windows

- `scripts/setup-windows.ps1 [-Bootstrap] [-TestTools]`: checks Node/Python, preserves existing settings,
  creates a root virtual environment when needed, installs locked frontend dependencies, and optionally
  checks database connections and bootstraps the stores. It uses Python on PATH (or the Python 3 launcher as fallback) and
  rejects Python older than 3.12. Node 22.14+ (22.x) or 24+ is required.
- `scripts/start-api.ps1` and `scripts/start-web.ps1`: separate terminal launchers, working independently
  of the caller's current directory. They avoid activation and npm PowerShell wrappers.
- `scripts/check-config.py [--connect]`: checks settings and optionally both database connections without
  printing passwords/connection strings. `.env.example` is never treated as active settings.
- Native command failures stop the scripts. No `Invoke-Expression` or manual command-string assembly
  is used. The obsolete WASI environment workaround is removed from the frontend process.
- `.gitattributes` keeps Linux/Docker sources on LF and PowerShell sources on CRLF in Git checkouts.

The direct PowerShell commands remain in the root README if a machine restricts script execution.
A native `windows-latest` CI job exercises setup in a directory containing spaces, unit/build/browser
checks on Node 22.14 and Node 24 in both Windows PowerShell 5.1 and PowerShell 7, and Python configuration tests. CI runs after you put this source in
your repository and trigger the workflow; adding the YAML does not mean it has already run.

## Docker

- `.env.docker.example` is separate from manual settings. Startup copies it only when no `.env.docker`
  exists. Use `--env-file .env.docker` on later Compose commands as well.
- Host ports: web 8080, API 8001, PostgreSQL 55432, MongoDB 57017. Internal database ports and service
  names remain unchanged. Override host ports in `.env.docker` if needed.
- PostgreSQL connection fields are passed separately; Python URL-encodes user/password/database names.
  Reserved password characters no longer break a URI interpolated directly by Compose. `DATABASE_URL`
  remains the first choice for existing manual installations. In a Compose env file, single-quote a
  password containing a dollar sign to avoid variable interpolation.
- Docker seed runs root `data_generation/bootstrap.py`, using the same `mongo/schema.json` and Python
  setup as manual installation. There is no separate JavaScript initialization service.
- The web service has a health check, complementing API and database checks. API waits for successful
  bootstrap; web waits for healthy API. `up --wait` waits for readiness.
- `scripts/start-docker.ps1` checks for a running Linux Docker engine, validates Compose and starts the
  stack. `scripts/test-docker.ps1 [-WebPort 8080]` verifies proxy/session behavior, six SPA routes,
  database health and live-data endpoints. `-HttpOnly` can check a manual server on port 5173 instead.
- Git/build ignores exclude private `.env*` files, while keeping the two example files and Dockerfiles
  trackable. Your credentials are excluded from the ZIP and container build context.

Compose uses named volumes. Existing volumes keep their original database password; editing the env
file alone does not change a password already stored in PostgreSQL. No script deletes volumes or
resets populated databases. To stop: `docker compose --env-file .env.docker down`.

A Linux CI job builds and starts the actual images, runs the PowerShell HTTP check through Nginx,
executes API integration tests against container databases and runs the live browser workflow through
production Nginx. It keeps this work separate from native Windows checks.

## Prior platform-release checks

- Existing 23 fixture browser scenarios passed; two additional scenarios exercise all six screens at
  1920 and 2560 px (25 browser scenarios in total).
- 16 frontend unit tests and production build passed using Node 22.14.0.
- 25 API/configuration tests passed against real local PostgreSQL 16.15 and MongoDB 7.0.16.
- All six PowerShell scripts parsed in PowerShell 7.6.7 on Linux; native command/error propagation was
  executed. This caught and corrected a Node version-check exit-code issue before packaging.
- The current Docker Compose CLI parsed/validated the model, ports, dependencies and health checks.
- GitHub workflow YAML and referenced paths were checked.
- The real seeded API/browser workflow passed after these changes. The PowerShell HTTP smoke check
  also passed against the local API/Vite proxy, covering sessions, health, six routes and data endpoints.
  This HTTP check used `-HttpOnly`; it was not a Docker/Nginx runtime test.

Native Windows execution and Docker image/engine execution are not available in this Linux session.
The provided scripts and CI jobs perform those checks on the appropriate hosts; no Windows or Docker
runtime pass is claimed here. See `docs/verification.md` for the live-stack check result.
