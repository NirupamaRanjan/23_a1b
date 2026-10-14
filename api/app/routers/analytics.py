from datetime import date, datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Request
from ..errors import PublicError

Page = Annotated[int, Query(ge=1, le=1000000)]
Size = Annotated[int, Query(ge=1, le=100)]
Id = Annotated[int, Query(gt=0, le=2147483647)]

router = APIRouter(prefix='/api/v1/analytics', tags=['analytics'])


def session(request: Request):
    return request.app.state.sessions.load(request)


def mutation(request: Request, actor=Depends(session)):
    request.app.state.sessions.mutation(request, actor)
    return actor


@router.get('/revenue')
def revenue(
    request: Request,
    clinic_id: Id,
    start_date: date | None = None,
    end_date: date | None = None,
    actor=Depends(session),
):
    return request.app.state.analytics.revenue(clinic_id, start_date, end_date)


@router.get('/ranking')
def ranking(
    request: Request,
    date: date | None = None,
    page: Page = 1,
    page_size: Size = 5,
    actor=Depends(session),
):
    return request.app.state.analytics.ranking(
        date or datetime.now(timezone.utc).date(), page, page_size
    )


@router.get('/monthly')
def monthly(request: Request, clinic_id: Id, month: date, actor=Depends(session)):
    return request.app.state.analytics.monthly(clinic_id, month)


@router.post('/monthly/refresh')
def refresh_monthly(request: Request, actor=Depends(mutation)):
    request.app.state.sessions.staff(actor)
    return request.app.state.analytics.refresh()
