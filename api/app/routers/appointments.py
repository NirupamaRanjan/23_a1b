from datetime import date
from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Query, Path as PathParam, Request
from ..errors import PublicError
from ..models import BookingInput, StatusInput

Page = Annotated[int, Query(ge=1, le=1000000)]
Size = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=120)]

router = APIRouter(prefix='/api/v1/appointments', tags=['appointments'])


def session(request: Request):
    return request.app.state.sessions.load(request)


def mutation(request: Request, actor=Depends(session)):
    request.app.state.sessions.mutation(request, actor)
    return actor


@router.get('')
def appointments(
    request: Request,
    q: Search = '',
    page: Page = 1,
    page_size: Size = 5,
    status: Literal['WAITING', 'IN_CONSULTATION', 'DISCHARGED'] | None = None,
    actor=Depends(session),
):
    return request.app.state.care.browse('appointments', actor, q, page, page_size, status=status)


@router.post('', status_code=201)
def book(
    request: Request,
    body: BookingInput,
    key: Annotated[UUID, Header(alias='Idempotency-Key')],
    actor=Depends(mutation),
):
    return request.app.state.care.book(actor, body, key)


@router.patch('/{record_id}/status')
def change_status(request: Request, record_id: Annotated[int, PathParam(gt=0, le=2147483647)], body: StatusInput,
                  actor=Depends(mutation)):
    return request.app.state.care.status(record_id, actor, body)


@router.get('/{record_id}')
def appointment_detail(request: Request, record_id: Annotated[int, PathParam(gt=0, le=2147483647)], actor=Depends(session)):
    if record_id < 1 or record_id > 2147483647:
        raise PublicError('VALIDATION_ERROR', 422)
    return request.app.state.care.detail('appointments', record_id, actor)
