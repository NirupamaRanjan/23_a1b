from typing import Annotated
from fastapi import APIRouter, Depends, Query, Request

Page = Annotated[int, Query(ge=1, le=1000000)]
Size = Annotated[int, Query(ge=1, le=5)]

router = APIRouter(tags=['mongo'])


def session(request: Request):
    return request.app.state.sessions.load(request)


@router.get('/api/v1/nurses/nearby')
def nearby(
    request: Request,
    latitude: Annotated[float, Query(ge=-90, le=90, allow_inf_nan=False)],
    longitude: Annotated[float, Query(ge=-180, le=180, allow_inf_nan=False)],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    actor=Depends(session),
):
    return request.app.state.mongo.nearby(latitude, longitude, limit)


@router.get('/api/v1/reviews/insights')
def reviews(request: Request, actor=Depends(session)):
    return request.app.state.mongo.reviews()


@router.get('/api/v1/catalogs')
def catalogs(
    request: Request,
    q: Annotated[str, Query(max_length=120)] = '',
    page: Page = 1,
    page_size: Annotated[int, Query(ge=1, le=5)] = 1,
    actor=Depends(session),
):
    return request.app.state.mongo.catalogs(q, page, page_size)
