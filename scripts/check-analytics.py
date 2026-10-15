"""Read-only diagnosis of empty analytics using the exact API PostgreSQL settings.

    python scripts/check-analytics.py --clinic-id 13
    python scripts/check-analytics.py --clinic-id 13 --start-date 2026-01-01 --end-date 2026-10-15

Does not seed, rename, discharge, refresh a view or write database records.
"""
import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'api'))
from app.config import Settings


def main():
    today = datetime.now(timezone.utc).date()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--clinic-id', type=int, required=True)
    parser.add_argument('--start-date', type=date.fromisoformat, default=today-timedelta(days=29))
    parser.add_argument('--end-date', type=date.fromisoformat, default=today)
    args = parser.parse_args()
    if args.clinic_id < 1 or args.start_date > args.end_date or args.end_date == date.max:
        parser.error('Use a positive clinic ID and an ordered valid date range.')
    until = args.end_date+timedelta(days=1)
    conn = psycopg2.connect(Settings().database_url, connect_timeout=5,
                           options='-c timezone=UTC -c statement_timeout=15000')
    try:
        conn.set_session(readonly=True)
        with conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            report = {}
            cur.execute('SELECT current_database() AS database, now() AS server_time_utc, CURRENT_DATE AS server_date_utc')
            report['connection'] = dict(cur.fetchone())
            report['requested_range'] = {'start_date':args.start_date, 'end_date':args.end_date}
            cur.execute('SELECT id,name FROM clinics WHERE id=%s', (args.clinic_id,))
            report['clinic'] = cur.fetchone()
            cur.execute('''SELECT status,COUNT(*) AS appointments,MIN(created_at) AS earliest,
                MAX(created_at) AS latest FROM appointments GROUP BY status ORDER BY status''')
            report['database_appointments_by_status'] = cur.fetchall()
            cur.execute('''SELECT status,COUNT(*) AS appointments,MIN(created_at) AS earliest,
                MAX(created_at) AS latest FROM appointments WHERE clinic_id=%s GROUP BY status ORDER BY status''', (args.clinic_id,))
            report['selected_clinic_by_status'] = cur.fetchall()
            cur.execute('''SELECT COUNT(*) AS discharged_appointments,
                COALESCE(SUM(copay_amount),0) AS revenue FROM appointments
                WHERE clinic_id=%s AND status='DISCHARGED' AND created_at >= %s AND created_at < %s''', (args.clinic_id,args.start_date,until))
            report['selected_clinic_requested_period'] = cur.fetchone()
            cur.execute('''SELECT c.id,c.name,COUNT(*) AS discharged_appointments,
                MIN(a.created_at) AS earliest,MAX(a.created_at) AS latest
                FROM clinics c JOIN appointments a ON a.clinic_id=c.id WHERE a.status='DISCHARGED'
                GROUP BY c.id,c.name ORDER BY discharged_appointments DESC,c.id LIMIT 10''')
            report['clinics_with_discharged_history'] = cur.fetchall()
            print(json.dumps(report, default=str, indent=2))
    finally:
        conn.close()


if __name__ == '__main__':
    main()
