CREATE OR REPLACE FUNCTION log_hsa_balance_change()
RETURNS TRIGGER AS $$
DECLARE
    diff DECIMAL(10,2);
    action_str VARCHAR(20);
BEGIN
    IF OLD.hsa_balance IS DISTINCT FROM NEW.hsa_balance THEN
        diff := NEW.hsa_balance - OLD.hsa_balance;
        IF diff > 0 THEN action_str := 'CREDIT'; ELSE action_str := 'DEBIT'; END IF;
        INSERT INTO wallet_audit_logs (patient_id, amount_changed, action_type, balance_after, timestamp)
        VALUES (NEW.id, ABS(diff), action_str, NEW.hsa_balance, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hsa_balance_audit
AFTER UPDATE OF hsa_balance ON patients
FOR EACH ROW
WHEN (OLD.hsa_balance IS DISTINCT FROM NEW.hsa_balance)
EXECUTE FUNCTION log_hsa_balance_change();

-- wallet_audit_logs is an immutable ledger: rows may be inserted (by the trigger
-- above) but never edited, deleted or truncated.
CREATE OR REPLACE FUNCTION wallet_audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'wallet_audit_logs is append-only (% not allowed)', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_audit_no_update_delete
BEFORE UPDATE OR DELETE ON wallet_audit_logs
FOR EACH ROW EXECUTE FUNCTION wallet_audit_logs_append_only();

CREATE TRIGGER trg_wallet_audit_no_truncate
BEFORE TRUNCATE ON wallet_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION wallet_audit_logs_append_only();

-- Appointments move one way only: WAITING -> IN_CONSULTATION -> DISCHARGED.
-- Updates that do not change the status are not affected.
CREATE OR REPLACE FUNCTION enforce_appointment_status_flow()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
           (OLD.status = 'WAITING'         AND NEW.status = 'IN_CONSULTATION')
        OR (OLD.status = 'IN_CONSULTATION' AND NEW.status = 'DISCHARGED')) THEN
        RAISE EXCEPTION 'Invalid status change % -> %', OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appointment_status_flow
BEFORE UPDATE OF status ON appointments
FOR EACH ROW EXECUTE FUNCTION enforce_appointment_status_flow();
