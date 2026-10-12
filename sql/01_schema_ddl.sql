CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hsa_balance DECIMAL(10,2) NOT NULL CHECK (hsa_balance >= 0.00)
);

CREATE TABLE wallet_audit_logs (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    amount_changed DECIMAL(10,2) NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('DEBIT', 'CREDIT')),
    balance_after DECIMAL(10,2) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clinics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    is_accepting_patients BOOLEAN DEFAULT TRUE
);

CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    clinic_id INT NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
    copay_amount DECIMAL(10,2) NOT NULL CHECK (copay_amount > 0.00),
    status VARCHAR(50) NOT NULL CHECK (status IN ('WAITING', 'IN_CONSULTATION', 'DISCHARGED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
