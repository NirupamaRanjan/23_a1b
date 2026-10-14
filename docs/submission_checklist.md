# Submission checklist

The requested distribution has exactly two top-level folders, `web/` and `api/`. Database code and assignment documentation therefore live inside `api/`. For Moodle's suggested repository layout, move `api/sql`, `api/mongo`, `api/data_generation`, and `api/docs` to the repository root **and update the relative paths in bootstrap.py, AnalyticsService, Dockerfile and Compose before doing so**; alternatively keep this working layout and state the organization assumption in README. The PDF labels the tree as suggested.

Before submitting:

1. Continue in your assigned fork without rewriting or replacing Assignment 1 commit history. This ZIP is a source distribution, not a replacement Git history.
2. Add the four actual team members and their true contributions to the contribution table in `api/README.md`.
3. Push the final source into your team repository and insert its URL and final commit hash in `api/README.md`. The inherited source hash is documented separately and must not be passed off as the final submission hash.
4. Record or review the ≤5-minute demonstration against seeded data and supply its final shareable link.
5. Rename the supplied ZIP to `<new_team_number>_a1b.zip` using your actual Assignment 2 team number. The inherited repository number 23 is not evidence of your new team number.
6. Keep the ZIP strictly under 20 MB. Exclude node_modules, environments, caches, build outputs and database dumps.
7. Each member should understand the inherited procedure, audit trigger, partial unique index, RANGE window, DENSE_RANK, materialized view, $geoNear and $facet for the viva.
