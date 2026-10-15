# Earlier live seeded-data demonstration

This video predates the wider layouts and latest Windows/Docker setup changes. It is retained as
historical integration evidence. Record/review a current walkthrough for the final submission and
update the root README's demo link; this file does not claim a new recording was made.


[Play the 20-second silent walkthrough](careconnect-live-demo.webm).

This recording uses the actual React frontend and FastAPI server with the inherited full PostgreSQL/MongoDB seed. No HTTP responses are mocked. It opens Browse, books a real appointment and shows the debit/trigger receipt, opens Audit, switches to clinic staff, starts/discharges the visit, refreshes Analytics, and opens Map and Reviews/catalog. Pause the recording to inspect figures. It was recorded as an automated browser integration check; it has no voiceover.

For a team presentation, record your own narrated version (under five minutes) and upload the reviewed video to the sharing service required by Moodle. `web/tests/live/database.spec.js` provides the reproducible walkthrough.
