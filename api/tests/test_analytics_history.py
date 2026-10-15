from datetime import datetime, timedelta, timezone
import pytest

pytestmark = pytest.mark.usefixtures('reset_data')


def test_historical_revenue_keeps_lookback_and_total_matches_selected_dates(client,database):
    db,_ = database
    day = datetime.now(timezone.utc).date()-timedelta(days=90)
    with db.cursor() as cur:
        for clinic in (1,2):
            for offset,amount in ((6,10),(2,20),(0,30)):
                cur.execute("INSERT INTO appointments(patient_id,clinic_id,copay_amount,status,created_at) VALUES(1,%s,%s,'DISCHARGED',%s)", (clinic,amount,day-timedelta(days=offset)))
        cur.execute("INSERT INTO appointments(patient_id,clinic_id,copay_amount,status,created_at) VALUES(1,1,200,'WAITING',%s)", (day,))
    single=client.get('/api/v1/analytics/revenue',params={'clinic_id':1,'start_date':str(day),'end_date':str(day)})
    assert single.status_code==200,single.text
    data=single.json()
    assert data['items']==[{'transaction_date':str(day),'daily_total':'30.00','moving_avg_7d':'20.00'}]
    assert data['total_copay_revenue']=='30.00'
    assert data['start_date']==data['end_date']==str(day)
    broad=client.get('/api/v1/analytics/revenue',params={'clinic_id':1,'start_date':str(day-timedelta(days=6)),'end_date':str(day)}).json()
    assert broad['total_copay_revenue']=='60.00' and len(broad['items'])==3
    assert client.get('/api/v1/analytics/revenue',params={'clinic_id':1}).json()['items']==[]
    ranked=client.get('/api/v1/analytics/ranking',params={'date':str(day)}).json()
    assert [r['rank_by_revenue'] for r in ranked['items']]==[1,1]
    assert {r['clinic_id'] for r in ranked['items']}=={1,2}


def test_empty_reversed_future_and_unknown_clinic_ranges_remain_honest(client):
    today=datetime.now(timezone.utc).date()
    old=today-timedelta(days=365)
    empty=client.get('/api/v1/analytics/revenue',params={'clinic_id':1,'start_date':str(old),'end_date':str(today)})
    assert empty.status_code==200
    assert empty.json()['items']==[] and empty.json()['total_copay_revenue']=='0.00'
    reversed_dates=client.get('/api/v1/analytics/revenue',params={'clinic_id':1,'start_date':str(today),'end_date':str(old)})
    assert reversed_dates.status_code==422 and reversed_dates.json()['code']=='INVALID_DATE_RANGE'
    future=client.get('/api/v1/analytics/revenue',params={'clinic_id':1,'end_date':str(today+timedelta(days=1))})
    assert future.status_code==422
    assert client.get('/api/v1/analytics/ranking',params={'date':str(today+timedelta(days=1))}).status_code==422
    assert client.get('/api/v1/analytics/revenue',params={'clinic_id':99999}).status_code==404
