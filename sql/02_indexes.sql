CREATE UNIQUE INDEX idx_active_consult ON appointments (patient_id) 
WHERE status IN ('WAITING', 'IN_CONSULTATION');

CREATE INDEX idx_appointments_discharged_analytics
ON appointments (created_at, clinic_id)
INCLUDE (copay_amount)
WHERE status = 'DISCHARGED';
