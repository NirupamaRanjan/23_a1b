import psycopg2
import random
import os
from datetime import datetime, timedelta

CONN_PARAMS = {
    "dbname": os.getenv("CARECONNECT_DB_NAME", "careconnect"),
    "user": os.getenv("CARECONNECT_DB_USER", "postgres"),
    "password": os.getenv("CARECONNECT_DB_PASSWORD"),
    "host": os.getenv("CARECONNECT_DB_HOST", "localhost"),
    "port": os.getenv("CARECONNECT_DB_PORT", "5432")
}

def seed():
    conn = psycopg2.connect(**CONN_PARAMS)
    cur = conn.cursor()
    
    print("Clearing old data...")
    # wallet_audit_logs is append-only (see sql/03); switch its guard triggers off only for this reset.
    cur.execute("ALTER TABLE wallet_audit_logs DISABLE TRIGGER USER;")
    cur.execute("TRUNCATE TABLE appointments, wallet_audit_logs, patients, clinics RESTART IDENTITY CASCADE;")
    cur.execute("ALTER TABLE wallet_audit_logs ENABLE TRIGGER USER;")
    conn.commit()

    print("Seeding Patients...")
    patients_data = [(f"Patient_{i}", random.uniform(100.0, 5000.0)) for i in range(1000)]
    cur.executemany("INSERT INTO patients (name, hsa_balance) VALUES (%s, %s)", patients_data)
    
    print("Seeding Clinics...")
    # Clinics are placed inside the area where mongo_seeder.py generates nurse pings
    # (centre 40.748817, -73.985130 +/- 0.1 deg) so a 5 km nurse search always finds nurses.
    clinics_data = [(f"Clinic_{i}", 40.70 + random.random() * 0.10, -74.03 + random.random() * 0.10, True) for i in range(50)]
    cur.executemany("INSERT INTO clinics (name, latitude, longitude, is_accepting_patients) VALUES (%s, %s, %s, %s)", clinics_data)
    conn.commit()

    print("Seeding Appointments (50,000)...")
    start_date = datetime.now() - timedelta(days=60)
    appointments = []
    for _ in range(50000):
        p_id = random.randint(1, 1000)
        c_id = random.randint(1, 50)
        copay = round(random.uniform(10.0, 150.0), 2)
        created_at = start_date + timedelta(minutes=random.randint(0, 86400))
        appointments.append((p_id, c_id, copay, 'DISCHARGED', created_at))
    
    cur.executemany("""
        INSERT INTO appointments (patient_id, clinic_id, copay_amount, status, created_at)
        VALUES (%s, %s, %s, %s, %s)
    """, appointments)
    
    print("Generating Ledger/Audit Logs (100,000 updates)...")
    for _ in range(100000):
        p_id = random.randint(1, 1000)
        amt = round(random.uniform(5.0, 50.0), 2)
        cur.execute("UPDATE patients SET hsa_balance = hsa_balance + %s WHERE id = %s", (amt, p_id))

    conn.commit()
    cur.close()
    conn.close()
    print("PostgreSQL Data Generation Complete!")

if __name__ == "__main__":
    seed()
