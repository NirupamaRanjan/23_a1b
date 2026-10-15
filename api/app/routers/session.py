from typing import Annotated
from fastapi import APIRouter, Depends, Query, Request, Response
from ..errors import PublicError
from ..models import ActorInput

Page = Annotated[int, Query(ge=1, le=1000000)]
Size = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=120)]

router = APIRouter(prefix='/api/v1/session', tags=['session'])


def _session_service(request: Request):
    return request.app.state.sessions


def _care_service(request: Request):
    return request.app.state.care


def session(request: Request):
    return request.app.state.sessions.load(request)


def mutation(request: Request, actor=Depends(session)):
    request.app.state.sessions.mutation(request, actor)
    return actor


@router.get('')
def get_session(request: Request, response: Response):
    sessions = _session_service(request)
    try:
        current = sessions.load(request)
    except PublicError:
        settings = request.app.state.settings
        if not settings.demo_mode:
            raise
        with request.app.state.database.cursor(readonly=True) as cur:
            cur.execute('SELECT id FROM patients ORDER BY id LIMIT 1')
            row = cur.fetchone()
        if not row:
            raise PublicError('NOT_FOUND', 404)
        token, current = sessions.create('patient', row['id'], row['id'])
        sessions.set_cookie(response, token)
    return sessions.payload(current)


def demo_only(request: Request):
    if not request.app.state.settings.demo_mode:
        raise PublicError('DEMO_MODE_OFF', 403)


@router.get('/actors', dependencies=[Depends(demo_only)])
def actors(request: Request, q: Search = '', page: Page = 1, page_size: Size = 5,
           actor=Depends(session)):
    settings = request.app.state.settings
    if not settings.demo_mode:
        raise PublicError('DEMO_MODE_OFF', 403)
    return request.app.state.care.actors(q, page, page_size)


@router.post('/actor', dependencies=[Depends(demo_only)])
def switch_actor(request: Request, body: ActorInput, response: Response,
                 actor=Depends(mutation)):
    settings = request.app.state.settings
    if not settings.demo_mode:
        raise PublicError('DEMO_MODE_OFF', 403)
    table = 'patients' if body.role == 'patient' else 'clinics'
    with request.app.state.database.cursor(readonly=True) as cur:
        cur.execute(f'SELECT id FROM {table} WHERE id=%s', (body.actor_id,))
        if not cur.fetchone():
            raise PublicError('NOT_FOUND', 404)
    patient_id = body.actor_id if body.role == 'patient' else actor['patient_id']
    token, current = request.app.state.sessions.create(
        body.role, body.actor_id, patient_id, actor['token_hash'])
    request.app.state.sessions.set_cookie(response, token)
    return request.app.state.sessions.payload(current)
