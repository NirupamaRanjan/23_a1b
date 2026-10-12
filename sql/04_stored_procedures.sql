CREATE OR REPLACE PROCEDURE sp_execute_appointment(
    p_patient_id INT,
    p_clinic_id INT,
    p_copay DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_curr_balance DECIMAL(10,2);
    v_accepting BOOLEAN;
    v_copay DECIMAL(10,2);
BEGIN
    IF p_patient_id IS NULL OR p_clinic_id IS NULL OR p_copay IS NULL THEN
        RAISE EXCEPTION 'Patient, clinic and copay are required';
    END IF;

    -- PL/pgSQL does not enforce the (10,2) typmod on parameters, so round here;
    -- otherwise the debit, the appointment and the audit row can differ by a cent.
    v_copay := ROUND(p_copay, 2);
    IF v_copay <= 0 THEN
        RAISE EXCEPTION 'Copay must be greater than zero';
    END IF;

    SELECT is_accepting_patients INTO v_accepting FROM clinics WHERE id = p_clinic_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Clinic ID % not found', p_clinic_id;
    END IF;
    IF v_accepting IS NOT TRUE THEN
        RAISE EXCEPTION 'Clinic ID % is not accepting patients', p_clinic_id;
    END IF;

    SELECT hsa_balance INTO v_curr_balance FROM patients WHERE id = p_patient_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient ID % not found', p_patient_id;
    END IF;
    IF v_curr_balance < v_copay THEN
        RAISE EXCEPTION 'Insufficient HSA Balance';
    END IF;

    -- A second active appointment is rejected by the partial unique index
    -- idx_active_consult (SQLSTATE 23505); the whole call then rolls back.
    UPDATE patients SET hsa_balance = hsa_balance - v_copay WHERE id = p_patient_id;
    INSERT INTO appointments (patient_id, clinic_id, copay_amount, status, created_at)
    VALUES (p_patient_id, p_clinic_id, v_copay, 'WAITING', NOW());
END;
$$;
