from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Request

Page = Annotated[int, Query(ge=1, le=1000000)]
Size = Annotated[int, Query(ge=1, le=100)]

router = APIRouter(prefix='/api/v1/me', tags=['me'])


def session(request: Request):
    return request.app.state.sessions.load(request)


@router.get('/audit')
def audit(
    request: Request,
    start_date: date | None = None,
    end_date: date | None = None,
    page: Page = 1,
    page_size: Size = 5,
    actor=Depends(session),
):
    return request.app.state.care.audit(actor, start_date, end_date, page, page_size)
