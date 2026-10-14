import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import Annotated, Literal
from uuid import UUID
from fastapi import Depends, FastAPI, Header, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg2 import Error as PostgresError
from psycopg2.pool import PoolError
from pymongo.errors import PyMongoError
from .config import Settings
from .database import Database
from .errors import PublicError, translate_postgres
from .models import ActorInput, BookingInput, StatusInput
from .security import SessionService
from .services import AnalyticsService, CareService
from .mongo_services import MongoService

logger = logging.getLogger('careconnect')
Page = Annotated[int, Query(ge=1,le=1000000)]
Size = Annotated[int, Query(ge=1,le=100)]
Search = Annotated[str, Query(max_length=120)]
Id = Annotated[int, Query(gt=0,le=2147483647)]


def create_app(settings=None, database=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        owned = database is None
        db = database or Database(settings)
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

    app = FastAPI(title='CareConnect API',version='1.0.0',lifespan=lifespan,
        docs_url='/api/docs',openapi_url='/api/openapi.json',redoc_url=None)

    @app.middleware('http')
    async def security_headers(request, call_next):
        # Reject large declared request bodies before parsing; all payload models are tiny.
        length = request.headers.get('content-length')
        if length and (not length.isdigit() or int(length)>8192):
            return JSONResponse({'code':'VALIDATION_ERROR'},status_code=413)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    @app.exception_handler(PublicError)
    async def public_error(request, error):
        return JSONResponse({'code':error.code},status_code=error.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        code = 'INVALID_COPAY' if any('copay_amount' in e['loc'] for e in error.errors()) else 'VALIDATION_ERROR'
        return JSONResponse({'code':code},status_code=422)

    @app.exception_handler(PostgresError)
    async def postgres_error(request,error):
        public = translate_postgres(error)
        if public.status>=500:
            logger.error('PostgreSQL failure: SQLSTATE %s', error.pgcode)
        return JSONResponse({'code':public.code},status_code=public.status)

    @app.exception_handler(PoolError)
    async def postgres_pool_error(request,error):
        logger.error('PostgreSQL connection pool failed: %s',type(error).__name__)
        return JSONResponse({'code':'POSTGRES_UNAVAILABLE'},status_code=503)

    @app.exception_handler(PyMongoError)
    async def mongo_error(request,error):
        logger.error('MongoDB request failed: %s',type(error).__name__)
        return JSONResponse({'code':'MONGO_UNAVAILABLE'},status_code=503)

    @app.exception_handler(Exception)
    async def unexpected_error(request,error):
        logger.error('Unexpected request failure: %s',type(error).__name__)
        return JSONResponse({'code':'INTERNAL_ERROR'},status_code=500)

    def session(request: Request):
        return app.state.sessions.load(request)

    def mutation(request: Request, actor=Depends(session)):
        app.state.sessions.mutation(request,actor)
        return actor

    def demo_only():
        if not settings.demo_mode:
            raise PublicError('DEMO_MODE_OFF',403)

    @app.get('/api/health')
    def health():
        with app.state.database.cursor(readonly=True) as cur:
            cur.execute('SELECT 1')
        app.state.database.mongo_client.admin.command('ping')
        return {'status':'ok'}

    @app.get('/api/v1/session')
    def get_session(request: Request, response: Response):
        try:
            current = app.state.sessions.load(request)
        except PublicError:
            if not settings.demo_mode:
                raise
            with app.state.database.cursor(readonly=True) as cur:
                cur.execute('SELECT id FROM patients ORDER BY id LIMIT 1')
                row = cur.fetchone()
            if not row:
                raise PublicError('NOT_FOUND',404)
            token,current = app.state.sessions.create('patient',row['id'],row['id'])
            app.state.sessions.set_cookie(response,token)
        return app.state.sessions.payload(current)

    @app.get('/api/v1/session/actors',dependencies=[Depends(demo_only)])
    def actors(q: Search='',page: Page=1,page_size: Size=5,actor=Depends(session)):
        return app.state.care.actors(q,page,page_size)

    @app.post('/api/v1/session/actor',dependencies=[Depends(demo_only)])
    def switch_actor(body: ActorInput,response: Response,actor=Depends(mutation)):
        table = 'patients' if body.role=='patient' else 'clinics'
        with app.state.database.cursor(readonly=True) as cur:
            cur.execute(f'SELECT id FROM {table} WHERE id=%s',(body.actor_id,))
            if not cur.fetchone():
                raise PublicError('NOT_FOUND',404)
        patient_id = body.actor_id if body.role=='patient' else actor['patient_id']
        token,current = app.state.sessions.create(body.role,body.actor_id,patient_id,actor['token_hash'])
        app.state.sessions.set_cookie(response,token)
        return app.state.sessions.payload(current)

    @app.get('/api/v1/patients')
    def patients(q: Search='',page: Page=1,page_size: Size=5,actor=Depends(session)):
        return app.state.care.browse('patients',actor,q,page,page_size)

    @app.get('/api/v1/clinics')
    def clinics(q: Search='',page: Page=1,page_size: Size=5,accepting: bool|None=None,actor=Depends(session)):
        return app.state.care.browse('clinics',actor,q,page,page_size,accepting=accepting)

    @app.get('/api/v1/appointments')
    def appointments(q: Search='',page: Page=1,page_size: Size=5,
        status: Literal['WAITING','IN_CONSULTATION','DISCHARGED']|None=None,actor=Depends(session)):
        return app.state.care.browse('appointments',actor,q,page,page_size,status=status)

    # Dynamic route registration is limited to the three fixed, allowlisted entities.
    def detail_handler(entity):
        def get_detail(record_id: int,actor=Depends(session)):
            if record_id<1 or record_id>2147483647:
                raise PublicError('VALIDATION_ERROR',422)
            return app.state.care.detail(entity,record_id,actor)
        return get_detail
    for entity in ('patients','clinics','appointments'):
        app.add_api_route('/api/v1/'+entity+'/{record_id}',detail_handler(entity),methods=['GET'],name=entity+'_detail')

    @app.post('/api/v1/appointments',status_code=201)
    def book(body: BookingInput,key: Annotated[UUID,Header(alias='Idempotency-Key')],actor=Depends(mutation)):
        return app.state.care.book(actor,body,key)

    @app.patch('/api/v1/appointments/{record_id}/status')
    def change_status(record_id: int,body: StatusInput,actor=Depends(mutation)):
        return app.state.care.status(record_id,actor,body)

    @app.get('/api/v1/me/audit')
    def audit(start_date: date|None=None,end_date: date|None=None,page: Page=1,page_size: Size=5,actor=Depends(session)):
        return app.state.care.audit(actor,start_date,end_date,page,page_size)

    @app.get('/api/v1/analytics/revenue')
    def revenue(clinic_id: Id,start_date: date|None=None,end_date: date|None=None,actor=Depends(session)):
        return app.state.analytics.revenue(clinic_id,start_date,end_date)

    @app.get('/api/v1/analytics/ranking')
    def ranking(date: date|None=None,page: Page=1,page_size: Size=5,actor=Depends(session)):
        return app.state.analytics.ranking(date or datetime.now(timezone.utc).date(),page,page_size)

    @app.get('/api/v1/analytics/monthly')
    def monthly(clinic_id: Id,month: date,actor=Depends(session)):
        return app.state.analytics.monthly(clinic_id,month)

    @app.post('/api/v1/analytics/monthly/refresh')
    def refresh_monthly(actor=Depends(mutation)):
        app.state.sessions.staff(actor)
        return app.state.analytics.refresh()

    @app.get('/api/v1/nurses/nearby')
    def nearby(latitude: Annotated[float,Query(ge=-90,le=90,allow_inf_nan=False)],
        longitude: Annotated[float,Query(ge=-180,le=180,allow_inf_nan=False)],
        limit: Annotated[int,Query(ge=1,le=50)]=10,actor=Depends(session)):
        return app.state.mongo.nearby(latitude,longitude,limit)

    @app.get('/api/v1/reviews/insights')
    def reviews(actor=Depends(session)):
        return app.state.mongo.reviews()

    @app.get('/api/v1/catalogs/specialties')
    def catalog_specialties(actor=Depends(session)):
        return app.state.mongo.specialties()

    @app.get('/api/v1/catalogs')
    def catalogs(q: Search='',specialty: Search='',page: Page=1,page_size: Annotated[int,Query(ge=1,le=5)]=1,actor=Depends(session)):
        return app.state.mongo.catalogs(q,page,page_size,specialty)

    return app

app = create_app()
