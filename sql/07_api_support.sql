-- Additive HTTP support; Part A tables/procedure/triggers remain intact.
CREATE TABLE IF NOT EXISTS api_sessions (
    token_hash TEXT PRIMARY KEY,
    csrf_token TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'staff')),
    actor_id INT NOT NULL,
    patient_id INT REFERENCES patients(id),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_sessions_expiry ON api_sessions(expires_at);

CREATE TABLE IF NOT EXISTS api_booking_requests (
    patient_id INT NOT NULL REFERENCES patients(id),
    request_key UUID NOT NULL,
    fingerprint TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (patient_id, request_key)
);

CREATE TABLE IF NOT EXISTS api_refresh_metadata (
    view_name TEXT PRIMARY KEY,
    last_refreshed_at TIMESTAMPTZ
);
INSERT INTO api_refresh_metadata(view_name) VALUES ('mv_clinic_monthly_discharges') ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_audit_patient_time ON wallet_audit_logs(patient_id, timestamp, id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id, id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id, id);
