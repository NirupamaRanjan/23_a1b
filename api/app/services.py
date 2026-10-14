import hashlib
import json
import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from psycopg2.extras import Json
from .database import transport
from .errors import PublicError

APPOINTMENT_SELECT = '''SELECT a.*, p.name AS patient_name, c.name AS clinic_name
    FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN clinics c ON c.id=a.clinic_id'''


def page_result(items, total, page, page_size, **extra):
    return transport(dict(items=items, total=total, pages=math.ceil(total/page_size),
        page=page, page_size=page_size, **extra))


def literal_search(q):
    return '%' + q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'


def date_bounds(start, end):
    if start and end and start > end:
        raise PublicError('INVALID_DATE_RANGE', 422)
    return start, end + timedelta(days=1) if end else None


class CareService:
    def __init__(self, database):
        self.database = database

    def actors(self, q, page, size):
        search = literal_search(q)
        source = "(SELECT 'patient' AS role,id,name FROM patients UNION ALL SELECT 'staff',id,name FROM clinics) actors"
        with self.database.cursor(readonly=True) as cur:
            cur.execute(f'SELECT COUNT(*) AS n FROM {source} WHERE name ILIKE %s', (search,))
            total = cur.fetchone()['n']
            cur.execute(f'SELECT * FROM {source} WHERE name ILIKE %s ORDER BY role,id LIMIT %s OFFSET %s', (search,size,(page-1)*size))
            return page_result(cur.fetchall(), total, page, size)

    def appointment_scope(self, session):
        return ('a.patient_id=%s', [session['actor_id']]) if session['role']=='patient' else ('a.clinic_id=%s', [session['actor_id']])

    def decorate(self, row, session):
        row['can_update_status'] = session['role']=='staff' and row['clinic_id']==session['actor_id'] and row['status']!='DISCHARGED'
        return row

    def browse(self, entity, session, q, page, size, accepting=None, status=None):
        # Only these fixed identifiers reach SQL. Every user value is bound separately.
        params = []
        if entity == 'appointments':
            source = APPOINTMENT_SELECT
            count_source = 'appointments a JOIN patients p ON p.id=a.patient_id JOIN clinics c ON c.id=a.clinic_id'
            clause, params = self.appointment_scope(session)
            clause += " AND (p.name ILIKE %s OR c.name ILIKE %s OR a.id::text=%s)"
            params += [literal_search(q), literal_search(q), q]
            if status:
                clause += ' AND a.status=%s'
                params.append(status)
            ordering = 'a.created_at DESC,a.id DESC'
        else:
            source = f'SELECT * FROM {entity}'
            count_source = entity
            clause = '(name ILIKE %s OR id::text=%s)'
            params = [literal_search(q), q]
            if entity=='patients' and session['role']=='patient':
                clause += ' AND id=%s'
                params.append(session['actor_id'])
            if entity=='clinics' and accepting is not None:
                clause += ' AND is_accepting_patients=%s'
                params.append(accepting)
            ordering = 'id'
        with self.database.cursor(readonly=True) as cur:
            cur.execute(f'SELECT COUNT(*) AS n FROM {count_source} WHERE {clause}', params)
            total = cur.fetchone()['n']
            cur.execute(f'{source} WHERE {clause} ORDER BY {ordering} LIMIT %s OFFSET %s', params+[size,(page-1)*size])
            rows = cur.fetchall()
        if entity=='appointments':
            rows = [self.decorate(row, session) for row in rows]
        return page_result(rows, total, page, size)

    def detail(self, entity, record_id, session):
        if entity=='patients' and session['role']=='patient' and record_id!=session['actor_id']:
            raise PublicError('OWN_RECORD_ONLY', 403)
        source = APPOINTMENT_SELECT if entity=='appointments' else f'SELECT * FROM {entity}'
        with self.database.cursor(readonly=True) as cur:
            if entity=='appointments':
                clause, params = self.appointment_scope(session)
                cur.execute(f'{source} WHERE a.id=%s AND {clause}', [record_id]+params)
            else:
                cur.execute(f'{source} WHERE id=%s', (record_id,))
            row = cur.fetchone()
        if not row:
            raise PublicError('NOT_FOUND', 404)
        return transport(self.decorate(row, session) if entity=='appointments' else row)

    def book(self, session, body, key):
        if session['role']!='patient':
            raise PublicError('PATIENT_ONLY', 403)
        patient_id = session['actor_id']
        fingerprint = hashlib.sha256(f'{body.clinic_id}:{body.copay_amount}'.encode()).hexdigest()
        with self.database.cursor() as cur:
            # Patient lock serializes bookings and idempotency checks for this actor.
            cur.execute('SELECT hsa_balance FROM patients WHERE id=%s FOR UPDATE', (patient_id,))
            patient = cur.fetchone()
            if not patient:
                raise PublicError('NOT_FOUND', 404)
            cur.execute('SELECT fingerprint,response FROM api_booking_requests WHERE patient_id=%s AND request_key=%s', (patient_id,str(key)))
            existing = cur.fetchone()
            if existing:
                if existing['fingerprint']!=fingerprint:
                    raise PublicError('REQUEST_KEY_CONFLICT', 409)
                return existing['response']
            cur.execute('SELECT id FROM clinics WHERE id=%s FOR SHARE', (body.clinic_id,))
            if not cur.fetchone():
                raise PublicError('CLINIC_NOT_FOUND', 404)
            cur.execute('SELECT COALESCE(MAX(id),0) AS id FROM wallet_audit_logs WHERE patient_id=%s', (patient_id,))
            previous_audit = cur.fetchone()['id']
            # The stored procedure owns the debit, insert and unique-index enforcement.
            cur.execute('CALL sp_execute_appointment(%s,%s,%s)', (patient_id,body.clinic_id,Decimal(body.copay_amount)))
            cur.execute(APPOINTMENT_SELECT+" WHERE a.patient_id=%s AND a.status IN ('WAITING','IN_CONSULTATION')", (patient_id,))
            appointment = self.decorate(cur.fetchone(), session)
            cur.execute('SELECT * FROM wallet_audit_logs WHERE patient_id=%s AND id>%s ORDER BY id', (patient_id,previous_audit))
            audit_rows = cur.fetchall()
            if len(audit_rows)!=1:
                raise RuntimeError('Expected exactly one trigger-generated debit')
            audit = audit_rows[0]
            result = transport({'appointment':appointment,'balance_before':patient['hsa_balance'],
                'balance_after':audit['balance_after'],'audit_log':audit})
            cur.execute('INSERT INTO api_booking_requests(patient_id,request_key,fingerprint,response) VALUES (%s,%s,%s,%s)',
                (patient_id,str(key),fingerprint,Json(result)))
        return result  # Context commits before a success is returned.

    def status(self, record_id, session, body):
        if session['role']!='staff':
            raise PublicError('STAFF_ONLY', 403)
        with self.database.cursor() as cur:
            cur.execute('SELECT * FROM appointments WHERE id=%s AND clinic_id=%s FOR UPDATE', (record_id,session['actor_id']))
            row = cur.fetchone()
            if not row:
                cur.execute('SELECT 1 FROM appointments WHERE id=%s', (record_id,))
                # Distinguish "another clinic's visit" from a visit that does not exist.
                raise PublicError('OTHER_CLINIC', 403) if cur.fetchone() else PublicError('NOT_FOUND', 404)
            if row['status']!=body.expected_status:
                raise PublicError('STATUS_CONFLICT', 409)
            if {'WAITING':'IN_CONSULTATION','IN_CONSULTATION':'DISCHARGED'}.get(row['status'])!=body.status:
                raise PublicError('INVALID_STATUS_TRANSITION', 409)
            cur.execute('UPDATE appointments SET status=%s WHERE id=%s', (body.status,record_id))
            cur.execute(APPOINTMENT_SELECT+' WHERE a.id=%s', (record_id,))
            result = transport(self.decorate(cur.fetchone(), session))
        return result

    def audit(self, session, start, end, page, size):
        patient_id = session['patient_id']
        if not patient_id:
            raise PublicError('NO_PATIENT_SELECTED', 403)
        start, until = date_bounds(start, end)
        clause = 'patient_id=%s'
        params = [patient_id]
        if start:
            clause += ' AND timestamp >= %s'
            params.append(start)
        if until:
            clause += ' AND timestamp < %s'
            params.append(until)
        with self.database.cursor(readonly=True) as cur:
            # A single snapshot keeps the current balance and paged ledger consistent.
            cur.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            cur.execute('SELECT hsa_balance FROM patients WHERE id=%s', (patient_id,))
            current = cur.fetchone()['hsa_balance']
            cur.execute('SELECT COUNT(*) AS n FROM wallet_audit_logs WHERE '+clause, params)
            total = cur.fetchone()['n']
            cur.execute('SELECT * FROM wallet_audit_logs WHERE '+clause+' ORDER BY timestamp,id LIMIT 1', params)
            first = cur.fetchone()
            if first:
                opening = first['balance_after'] + (first['amount_changed'] if first['action_type']=='DEBIT' else -first['amount_changed'])
            else:
                # For an empty period, use the most recent entry before its upper bound.
                cutoff = until or start or datetime.now(timezone.utc)
                cur.execute('SELECT balance_after FROM wallet_audit_logs WHERE patient_id=%s AND timestamp<%s ORDER BY timestamp DESC,id DESC LIMIT 1', (patient_id,cutoff))
                previous = cur.fetchone()
                if previous:
                    opening = previous['balance_after']
                else:
                    cur.execute('SELECT * FROM wallet_audit_logs WHERE patient_id=%s ORDER BY timestamp,id LIMIT 1', (patient_id,))
                    earliest = cur.fetchone()
                    opening = current if not earliest else earliest['balance_after'] + (earliest['amount_changed'] if earliest['action_type']=='DEBIT' else -earliest['amount_changed'])
            # Newest entries first; each row keeps its own stored running balance.
            cur.execute('SELECT * FROM wallet_audit_logs WHERE '+clause+' ORDER BY timestamp DESC,id DESC LIMIT %s OFFSET %s', params+[size,(page-1)*size])
            rows = cur.fetchall()
            cur.execute("SELECT EXISTS(SELECT 1 FROM appointments WHERE patient_id=%s AND status IN ('WAITING','IN_CONSULTATION')) AS active", (patient_id,))
            active = cur.fetchone()['active']
        return page_result(rows,total,page,size,current_balance=current,opening_balance=opening,has_active_appointment=active)


class AnalyticsService:
    def __init__(self, database):
        self.database = database
        # Run the inherited query, including RANGE window and DENSE_RANK, in PostgreSQL.
        from pathlib import Path
        self.query = (Path(__file__).resolve().parent.parent.parent/'sql/06_window_analytics.sql').read_text().strip().rstrip(';')

    def revenue(self, clinic_id, start, end):
        today = datetime.now(timezone.utc).date()
        first_day = today - timedelta(days=30)
        start = start or first_day
        end = end or today
        date_bounds(start,end)
        if start<first_day or end>today:
            raise PublicError('DATE_OUTSIDE_WINDOW', 422)
        with self.database.cursor(readonly=True) as cur:
            cur.execute('SELECT id FROM clinics WHERE id=%s', (clinic_id,))
            if not cur.fetchone():
                raise PublicError('NOT_FOUND',404)
            # Filtering AFTER the window prevents a shortened visible range changing averages.
            cur.execute(f'''WITH inherited AS ({self.query})
                SELECT transaction_date,daily_total,moving_avg_7d FROM inherited
                WHERE clinic_id=%s AND transaction_date BETWEEN %s AND %s ORDER BY transaction_date''', (clinic_id,start,end))
            rows = cur.fetchall()
            cur.execute('''SELECT COALESCE(SUM(copay_amount),0)::numeric(20,2) AS total FROM appointments
                WHERE clinic_id=%s AND status='DISCHARGED' AND created_at >= CURRENT_DATE-INTERVAL '30 days' ''', (clinic_id,))
            total = cur.fetchone()['total']
        return transport({'items':rows,'total_copay_revenue':total})

    def ranking(self, day, page, size):
        with self.database.cursor(readonly=True) as cur:
            cur.execute(f'WITH inherited AS ({self.query}) SELECT COUNT(*) AS n FROM inherited WHERE transaction_date=%s', (day,))
            total = cur.fetchone()['n']
            cur.execute(f'''WITH inherited AS ({self.query}) SELECT i.*,c.name AS clinic_name
                FROM inherited i JOIN clinics c ON c.id=i.clinic_id WHERE transaction_date=%s
                ORDER BY rank_by_revenue,clinic_id LIMIT %s OFFSET %s''', (day,size,(page-1)*size))
            return page_result(cur.fetchall(),total,page,size)

    def monthly(self, clinic_id, month):
        if month.day!=1:
            raise PublicError('INVALID_MONTH',422)
        with self.database.cursor(readonly=True) as cur:
            cur.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            cur.execute('SELECT id FROM clinics WHERE id=%s', (clinic_id,))
            if not cur.fetchone():
                raise PublicError('NOT_FOUND',404)
            cur.execute('SELECT total_discharges FROM mv_clinic_monthly_discharges WHERE clinic_id=%s AND month_year=%s', (clinic_id,month))
            row = cur.fetchone()
            cur.execute("SELECT last_refreshed_at FROM api_refresh_metadata WHERE view_name='mv_clinic_monthly_discharges'")
            metadata = cur.fetchone()
        return transport({'total_discharges':row['total_discharges'] if row else 0,
            'last_refreshed_at':metadata['last_refreshed_at'] if metadata else None})

    def refresh(self):
        with self.database.cursor() as cur:
            cur.execute('SELECT pg_try_advisory_xact_lock(673024) AS acquired')
            if not cur.fetchone()['acquired']:
                raise PublicError('REFRESH_IN_PROGRESS',409)
            cur.execute('SELECT refresh_clinic_monthly_discharges()')
            cur.execute("UPDATE api_refresh_metadata SET last_refreshed_at=clock_timestamp() WHERE view_name='mv_clinic_monthly_discharges' RETURNING last_refreshed_at")
            result = transport(cur.fetchone())
        return result
