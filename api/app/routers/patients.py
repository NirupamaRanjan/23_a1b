from typing import Annotated
from fastapi import APIRouter, Depends, Query, Request
from ..errors import PublicError

Page = Annotated[int, Query(ge=1, le=1000000)]
Size = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=120)]

router = APIRouter(prefix='/api/v1/patients', tags=['patients'])


def session(request: Request):
    return request.app.state.sessions.load(request)


@router.get('')
def patients(request: Request, q: Search = '', page: Page = 1, page_size: Size = 5,
             actor=Depends(session)):
    return request.app.state.care.browse('patients', actor, q, page, page_size)


@router.get('/{record_id}')
def patient_detail(request: Request, record_id: int, actor=Depends(session)):
    if record_id < 1 or record_id > 2147483647:
        raise PublicError('VALIDATION_ERROR', 422)
    return request.app.state.care.detail('patients', record_id, actor)
