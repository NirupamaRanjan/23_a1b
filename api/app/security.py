import hashlib
import secrets
from fastapi import Request
from .errors import PublicError
from .database import transport

COOKIE = 'careconnect_session'

class SessionService:
    def __init__(self, database, settings):
        self.database = database
        self.settings = settings

    def load(self, request):
        token = request.cookies.get(COOKIE, '')
        digest = hashlib.sha256(token.encode()).hexdigest()
        with self.database.cursor(readonly=True) as cur:
            cur.execute('SELECT * FROM api_sessions WHERE token_hash=%s AND expires_at>NOW()', (digest,))
            session = cur.fetchone()
        if not session:
            raise PublicError('SESSION_EXPIRED', 401)
        return session

    def create(self, role, actor_id, patient_id=None, previous_hash=None):
        token = secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode()).hexdigest()
        csrf = secrets.token_urlsafe(32)
        with self.database.cursor() as cur:
            # Garbage collection is bounded by the indexed expiry predicate.
            cur.execute('DELETE FROM api_sessions WHERE expires_at < NOW()')
            if previous_hash:
                cur.execute('DELETE FROM api_sessions WHERE token_hash=%s', (previous_hash,))
            cur.execute('''INSERT INTO api_sessions(token_hash,csrf_token,role,actor_id,patient_id,expires_at)
                VALUES (%s,%s,%s,%s,%s,NOW()+%s*INTERVAL '1 hour') RETURNING *''',
                (digest, csrf, role, actor_id, patient_id, self.settings.session_hours))
            session = cur.fetchone()
        return token, session

    def set_cookie(self, response, token):
        response.set_cookie(COOKIE, token, max_age=self.settings.session_hours*3600,
            httponly=True, secure=self.settings.cookie_secure, samesite='strict', path='/api/v1')

    def payload(self, session):
        with self.database.cursor(readonly=True) as cur:
            cur.execute('SELECT * FROM patients WHERE id=%s', (session['patient_id'],))
            patient = cur.fetchone()
            if session['role'] == 'patient':
                if not patient or patient['id'] != session['actor_id']:
                    raise PublicError('SESSION_EXPIRED', 401)
                actor = {'role':'patient', 'id':patient['id'], 'name':patient['name']}
                cur.execute('SELECT * FROM clinics ORDER BY id LIMIT 1')
            else:
                cur.execute('SELECT * FROM clinics WHERE id=%s', (session['actor_id'],))
            clinic = cur.fetchone()
            if session['role'] == 'staff':
                if not clinic:
                    raise PublicError('SESSION_EXPIRED', 401)
                actor = {'role':'staff', 'id':clinic['id'], 'name':clinic['name']}
        return transport({'actor':actor, 'patient':patient, 'clinic':clinic,
            'csrf_token':session['csrf_token'], 'demo_mode':self.settings.demo_mode})

    def mutation(self, request, session):
        supplied = request.headers.get('x-csrf-token', '')
        origin = request.headers.get('origin', '')
        if origin not in self.settings.allowed_origins or not supplied or not secrets.compare_digest(supplied, session['csrf_token']):
            raise PublicError('CSRF_FAILED', 403)
        if request.headers.get('sec-fetch-site') in ('cross-site',):
            raise PublicError('CSRF_FAILED', 403)

    @staticmethod
    def staff(session):
        if session['role'] != 'staff':
            raise PublicError('STAFF_ONLY', 403)
