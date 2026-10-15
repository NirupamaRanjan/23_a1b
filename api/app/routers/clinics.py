from typing import Annotated
from fastapi import APIRouter, Depends, Query, Path as PathParam, Request
from ..errors import PublicError

Page = Annotated[int, Query(ge=1, le=1000000)]
Size = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=120)]

router = APIRouter(prefix='/api/v1/clinics', tags=['clinics'])


def session(request: Request):
    return request.app.state.sessions.load(request)


@router.get('')
def clinics(request: Request, q: Search = '', page: Page = 1, page_size: Size = 5,
            accepting: bool | None = None, actor=Depends(session)):
    return request.app.state.care.browse('clinics', actor, q, page, page_size, accepting=accepting)


@router.get('/{record_id}')
def clinic_detail(request: Request, record_id: Annotated[int, PathParam(gt=0, le=2147483647)], actor=Depends(session)):
    if record_id < 1 or record_id > 2147483647:
        raise PublicError('VALIDATION_ERROR', 422)
    return request.app.state.care.detail('clinics', record_id, actor)
