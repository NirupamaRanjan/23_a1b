import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg2 import Error as PostgresError
from psycopg2.pool import PoolError
from pymongo.errors import PyMongoError
from .config import Settings
from .database import Database
from .errors import PublicError, translate_postgres
from .security import SessionService
from .services import CareService, AnalyticsService
from .mongo_services import MongoService
from .routers import session, patients, clinics, appointments, analytics, mongo, me

logger = logging.getLogger('careconnect')


def create_app(settings=None, database=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        owned = database is None
        db = database or Database(settings)
        app.state.settings = settings
        app.state.database = db
        app.state.care = CareService(db)
        app.state.analytics = AnalyticsService(db)
        app.state.mongo = MongoService(db)
        app.state.sessions = SessionService(db, settings)
        try:
            yield
        finally:
            if owned:
                db.close()

    app = FastAPI(
        title='CareConnect API',
        version='1.0.0',
        lifespan=lifespan,
        docs_url='/api/docs',
        openapi_url='/api/openapi.json',
        redoc_url=None,
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    @app.middleware('http')
    async def security_headers(request, call_next):
        # Reject large declared request bodies before parsing; all payload models are tiny.
        length = request.headers.get('content-length')
        if length and (not length.isdigit() or int(length) > 8192):
            return JSONResponse({'code': 'VALIDATION_ERROR'}, status_code=413)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    # ── Exception handlers ────────────────────────────────────────────────────
    @app.exception_handler(PublicError)
    async def public_error(request, error):
        return JSONResponse({'code': error.code}, status_code=error.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        code = ('INVALID_COPAY'
                if any('copay_amount' in e['loc'] for e in error.errors())
                else 'VALIDATION_ERROR')
        return JSONResponse({'code': code}, status_code=422)

    @app.exception_handler(PostgresError)
    async def postgres_error(request, error):
        public = translate_postgres(error)
        if public.status >= 500:
            logger.error('PostgreSQL failure: SQLSTATE %s', error.pgcode)
        return JSONResponse({'code': public.code}, status_code=public.status)

    @app.exception_handler(PoolError)
    @app.exception_handler(PyMongoError)
    async def database_error(request, error):
        logger.error('Database request failed: %s', type(error).__name__)
        return JSONResponse({'code': 'DATABASE_UNAVAILABLE'}, status_code=503)

    @app.exception_handler(Exception)
    async def unexpected_error(request, error):
        logger.error('Unexpected request failure: %s', type(error).__name__)
        return JSONResponse({'code': 'INTERNAL_ERROR'}, status_code=500)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get('/api/health')
    def health():
        with app.state.database.cursor(readonly=True) as cur:
            cur.execute('SELECT 1')
        app.state.database.mongo_client.admin.command('ping')
        return {'status': 'ok'}

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(session.router)
    app.include_router(patients.router)
    app.include_router(clinics.router)
    app.include_router(appointments.router)
    app.include_router(analytics.router)
    app.include_router(me.router)
    app.include_router(mongo.router)

    return app


app = create_app()
