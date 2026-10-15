from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from uuid import uuid4
from dataclasses import replace
import psycopg2
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.models import BookingInput
from conftest import switch

pytestmark = pytest.mark.usefixtures('reset_data')


def book(client,amount='25.00',clinic=1,key=None):
    return client.post('/api/v1/appointments',json={'clinic_id':clinic,'copay_amount':amount},
        headers={'Idempotency-Key':str(key or uuid4())})


def test_booking_trigger_retry_conflict_and_rollback(client,database):
    key=uuid4()
    result=book(client,key=key)
    assert result.status_code==201,result.text
    payload=result.json()
    assert payload['balance_before']=='1000.00'
    assert payload['balance_after']=='975.00'
    assert payload['audit_log']['action_type']=='DEBIT'
    assert payload['audit_log']['amount_changed']=='25.00'
    assert payload['appointment']['status']=='WAITING'
    assert book(client,key=key).json()==payload
    assert book(client,amount='26.00',key=key).json()['code']=='REQUEST_KEY_CONFLICT'
    assert book(client).json()['code']=='ACTIVE_VISIT_EXISTS'
    assert client.get('/api/v1/session').json()['patient']['hsa_balance']=='975.00'
    assert client.get('/api/v1/me/audit').json()['total']==1
    # Idempotency and server sessions survive a new API process/application instance.
    db,settings=database
    with TestClient(create_app(settings,db)) as restarted:
        restarted.cookies.update(client.cookies)
        restarted.headers.update(client.headers)
        assert book(restarted,key=key).json()==payload

@pytest.mark.parametrize('amount',['0','-1','NaN','Infinity','1.001','100000000.00','1e2'])
def test_invalid_money(client,amount):
    result=book(client,amount)
    assert result.status_code==422
    assert result.json()['code']=='INVALID_COPAY'
    assert client.get('/api/v1/me/audit').json()['total']==0


def test_failure_cases_do_not_debit(client):
    assert book(client,amount='1001.00').json()['code']=='INSUFFICIENT_HSA_BALANCE'
    assert book(client,clinic=3).json()['code']=='CLINIC_NOT_ACCEPTING'
    assert book(client,clinic=99999).json()['code']=='CLINIC_NOT_FOUND'
    assert client.get('/api/v1/session').json()['patient']['hsa_balance']=='1000.00'
    assert client.get('/api/v1/me/audit').json()['total']==0


def test_status_authorization_compare_and_set_and_second_booking(client):
    row=book(client).json()['appointment']
    path=f"/api/v1/appointments/{row['id']}/status"
    body={'status':'IN_CONSULTATION','expected_status':'WAITING'}
    assert client.patch(path,json=body).status_code==403
    switch(client,'staff',2)
    assert client.patch(path,json=body).json()['code']=='OTHER_CLINIC'
    switch(client,'staff',1)
    assert client.patch(path,json={'status':'DISCHARGED','expected_status':'WAITING'}).json()['code']=='INVALID_STATUS_TRANSITION'
    assert client.patch(path,json=body).json()['status']=='IN_CONSULTATION'
    assert client.patch(path,json=body).json()['code']=='STATUS_CONFLICT'
    assert client.patch(path,json={'status':'DISCHARGED','expected_status':'IN_CONSULTATION'}).json()['status']=='DISCHARGED'
    assert client.patch(path,json={'status':'WAITING','expected_status':'DISCHARGED'}).json()['code']=='INVALID_STATUS_TRANSITION'
    switch(client,'patient',1)
    assert book(client).status_code==201


def test_csrf_session_rotation_and_production_demo_disabled(client,database):
    assert book(client).status_code==201
    bad={'role':'staff','actor_id':1}
    assert client.post('/api/v1/session/actor',json=bad,headers={'X-CSRF-Token':'wrong'}).json()['code']=='CSRF_FAILED'
    assert client.post('/api/v1/session/actor',json=bad,headers={'Origin':'https://evil.example'}).status_code==403
    old_token=client.headers['X-CSRF-Token']
    switch(client,'staff',1)
    assert client.post('/api/v1/analytics/monthly/refresh',headers={'X-CSRF-Token':old_token}).status_code==403
    db,settings=database
    with TestClient(create_app(replace(settings,demo_mode=False),db)) as production:
        assert production.get('/api/v1/session').status_code==401
        assert production.post('/api/v1/session/actor',json=bad).status_code==403


def test_visibility_literal_search_bounded_paging_and_dates(client):
    rows=client.get('/api/v1/patients').json()
    assert rows['total']==1 and rows['items'][0]['id']==1
    assert client.get('/api/v1/patients/2').status_code==403
    assert client.get('/api/v1/clinics?q=%25').json()['total']==0
    assert client.get('/api/v1/clinics',params={'q':"' OR 1=1 --"}).json()['total']==0
    assert client.get('/api/v1/clinics?page_size=101').status_code==422
    assert client.get('/api/v1/clinics?page=0').status_code==422
    assert client.get('/api/v1/me/audit?start_date=2026-10-13&end_date=2026-10-12').status_code==422
    assert client.get('/api/v1/nurses/nearby?latitude=nan&longitude=0').status_code==422
    assert client.get('/api/v1/nurses/nearby?latitude=91&longitude=0').status_code==422
    assert client.post('/api/v1/appointments',json={'clinic_id':1,'copay_amount':'25','patient_id':2},headers={'Idempotency-Key':str(uuid4())}).status_code==422


def test_concurrent_bookings_and_exact_once_retry(client,database):
    db,_=database
    actor={'role':'patient','actor_id':1,'patient_id':1}
    from app.services import CareService
    service=CareService(db)
    body=BookingInput(clinic_id=1,copay_amount='10.00')
    key=uuid4()
    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes=list(executor.map(lambda _:service.book(actor,body,key),range(2)))
    assert outcomes[0]==outcomes[1]
    with db.cursor(readonly=True) as cur:
        cur.execute('SELECT hsa_balance FROM patients WHERE id=1')
        assert str(cur.fetchone()['hsa_balance'])=='990.00'
        cur.execute('SELECT COUNT(*) AS n FROM wallet_audit_logs')
        assert cur.fetchone()['n']==1


def test_audit_opening_running_balances_and_empty_period(client,database):
    db,_=database
    # Three real balance updates fire the inherited trigger; no synthetic ledger rows.
    with db.cursor() as cur:
        for amount in (10,-20,5):
            cur.execute('UPDATE patients SET hsa_balance=hsa_balance+%s WHERE id=1',(amount,))
    first=client.get('/api/v1/me/audit?page_size=1').json()
    second=client.get('/api/v1/me/audit?page_size=1&page=2').json()
    assert first['total']==3 and first['opening_balance']=='1000.00'
    assert second['opening_balance']=='1000.00' and second['items'][0]['balance_after']=='990.00'
    assert first['current_balance']=='995.00'
    # Newest entry first: the latest balance leads the first page.
    assert first['items'][0]['balance_after']=='995.00'
    empty=client.get('/api/v1/me/audit?start_date=2000-01-01&end_date=2000-01-02').json()
    assert empty['total']==0 and empty['opening_balance']=='1000.00'


def test_analytics_window_dense_rank_and_durable_refresh(client,database):
    db,_=database
    today=datetime.now(timezone.utc).date()
    with db.cursor() as cur:
        for clinic in (1,2):
            for offset,amount in ((4,10),(2,20),(0,30)):
                cur.execute("INSERT INTO appointments(patient_id,clinic_id,copay_amount,status,created_at) VALUES (1,%s,%s,'DISCHARGED',%s)",(clinic,amount,today-timedelta(days=offset)))
    series=client.get('/api/v1/analytics/revenue',params={'clinic_id':1,'start_date':str(today),'end_date':str(today)}).json()
    assert series['items'][0]['moving_avg_7d']=='20.00'  # AVG of 3 recorded days, not zero-filled days.
    assert series['total_copay_revenue']=='30.00'
    ranked=client.get('/api/v1/analytics/ranking',params={'date':str(today)}).json()
    assert [row['rank_by_revenue'] for row in ranked['items']]==[1,1]
    assert client.post('/api/v1/analytics/monthly/refresh').status_code==403
    switch(client,'staff',1)
    stamp=client.post('/api/v1/analytics/monthly/refresh').json()['last_refreshed_at']
    monthly=client.get('/api/v1/analytics/monthly',params={'clinic_id':1,'month':str(today.replace(day=1))}).json()
    assert monthly['total_discharges']==3 and monthly['last_refreshed_at']==stamp
    # The advisory lock rejects overlapping refreshes across API processes.
    with db.cursor() as cur:
        cur.execute('SELECT pg_advisory_xact_lock(673024)')
        assert client.post('/api/v1/analytics/monthly/refresh').json()['code']=='REFRESH_IN_PROGRESS'
    with db.cursor(readonly=True) as cur:
        cur.execute("SELECT last_refreshed_at FROM api_refresh_metadata WHERE view_name='mv_clinic_monthly_discharges'")
        assert cur.fetchone()['last_refreshed_at'].isoformat()==stamp


def test_audit_and_status_triggers_remain_enforced(client,database):
    db,_=database
    row=book(client).json()['appointment']
    for sql in ('UPDATE wallet_audit_logs SET amount_changed=1','DELETE FROM wallet_audit_logs','TRUNCATE wallet_audit_logs',f"UPDATE appointments SET status='DISCHARGED' WHERE id={row['id']}"):
        with pytest.raises(psycopg2.Error):
            with db.cursor() as cur:
                cur.execute(sql)


def test_geonear_latest_offline_outside_stale_and_polling(client,database):
    db,_=database
    now=datetime.now(timezone.utc)
    def ping(nurse,longitude=-73.98513,active=True,minutes=0):
        return {'nurse_id':nurse,'is_active':active,'created_at':now-timedelta(minutes=minutes),
            'location':{'type':'Point','coordinates':[longitude,40.748817]}}
    db.mongo.NursePings.insert_many([
        ping(1,minutes=10),ping(1,-73.98),ping(2,minutes=10),ping(2,active=False),
        ping(3,minutes=10),ping(3,-74.2),ping(4,minutes=121),ping(5,-73.975),
        ping(6,-73.985,minutes=10),ping(6,-73.974)])
    path='/api/v1/nurses/nearby?latitude=40.748817&longitude=-73.98513'
    result=client.get(path)
    assert result.status_code==200,result.text
    rows=result.json()['items']
    assert [row['nurse_id'] for row in rows]==[1,5,6]
    assert rows[2]['location']['coordinates'][0]==-73.974
    assert all(row['dist']['calculated']<=5000 for row in rows)
    db.mongo.NursePings.insert_one(ping(7))
    assert client.get(path).json()['items'][0]['nurse_id']==7
    assert len(client.get(path+'&limit=1').json()['items'])==1


def test_facet_empty_and_flexible_catalog(client,database):
    db,_=database
    empty=client.get('/api/v1/reviews/insights').json()
    assert empty['total_reviews']==0 and empty['avg_rating'] is None
    db.mongo.PatientReviews.insert_many([{'rating':5,'bedside_manner_tags':['Friendly','Attentive']},{'rating':3,'bedside_manner_tags':['Friendly']}])
    result=client.get('/api/v1/reviews/insights').json()
    assert result['avg_rating']==4 and result['total_reviews']==2
    assert result['rating_distribution'][0]=={'rating':1,'count':0}
    assert result['frequent_tags'][0]=={'tag':'Friendly','count':2}
    db.mongo.MedicalCatalogs.insert_one({'specialty':'General <script>','availability_slots':[],
        'medication_details':{'name':'Example'},'extra':{'nested':['<img onerror=alert(1)>']},'created_at':datetime.now(timezone.utc)})
    catalog=client.get('/api/v1/catalogs').json()['items'][0]
    assert isinstance(catalog['id'],str) and catalog['extra']['nested'][0]=='<img onerror=alert(1)>'
    assert client.get('/api/v1/catalogs?q=.*').json()['total']==0
    db.mongo.MedicalCatalogs.insert_many([{'specialty':'Cardiology'},{'specialty':'Cardiology'}])
    chips=client.get('/api/v1/catalogs/specialties').json()['items']
    assert chips==[{'specialty':'Cardiology','count':2},{'specialty':'General <script>','count':1}]
    assert client.get('/api/v1/catalogs?specialty=Cardiology').json()['total']==2
    assert client.get('/api/v1/catalogs?specialty=Cardio').json()['total']==0


def test_out_of_range_paths_and_maximum_date_are_validation_errors(client):
    for record_id in (-1, 0, 2147483648):
        for entity in ('patients', 'clinics', 'appointments'):
            assert client.get(f'/api/v1/{entity}/{record_id}').status_code == 422
        response = client.patch(f'/api/v1/appointments/{record_id}/status',
            json={'status':'IN_CONSULTATION','expected_status':'WAITING'})
        assert response.status_code == 422
    assert client.get('/api/v1/me/audit?end_date=9999-12-31').status_code == 422


def test_manual_bootstrap_indexes_are_idempotent_and_preserve_data(database):
    from mongo.setup import apply_schema
    db, _ = database
    row = {'nurse_id':99, 'is_active':True,
           'location':{'type':'Point','coordinates':[-73.98513,40.748817]},
           'created_at':datetime.now(timezone.utc)}
    inserted = db.mongo.NursePings.insert_one(row).inserted_id
    apply_schema(db.mongo)
    apply_schema(db.mongo)
    assert db.mongo.NursePings.find_one({'_id':inserted})['nurse_id'] == 99
    info = db.mongo.NursePings.index_information()
    assert any(value['key'] == [('nurse_id',1),('created_at',-1),('_id',-1)] for value in info.values())
    assert any(value.get('expireAfterSeconds') == 7200 for value in info.values())
    from pymongo.errors import WriteError
    with pytest.raises(WriteError) as rejected:
        db.mongo.NursePings.insert_one({**row, '_id': 'invalid-ping', 'is_active': 'yes'})
    assert rejected.value.code == 121
    from mongo.setup import check_schema
    assert check_schema(db.mongo) == []


def test_concurrent_different_booking_keys_cannot_double_debit(client,database):
    db, _ = database
    from app.services import CareService
    service = CareService(db)
    actor = {'role':'patient','actor_id':1,'patient_id':1}
    body = BookingInput(clinic_id=1,copay_amount='10.00')
    def attempt(_):
        try:
            service.book(actor,body,uuid4())
            return 'ok'
        except psycopg2.IntegrityError as error:
            return error.pgcode
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(attempt,range(2))) == ['23505','ok']
    assert client.get('/api/v1/me/audit').json()['total'] == 1
    assert client.get('/api/v1/session').json()['patient']['hsa_balance'] == '990.00'


def test_catalog_specialty_route_enforces_the_same_bounds(client):
    assert client.get('/api/v1/catalogs',params={'specialty':'a'*121}).status_code == 422
    assert client.get('/api/v1/catalogs/specialties').status_code == 200


def test_missing_map_index_is_diagnosed_and_root_setup_repairs_it(client, database):
    from mongo.setup import apply_schema
    db, _ = database
    db.mongo.NursePings.drop_index('location_2dsphere')
    try:
        response = client.get('/api/v1/nurses/nearby?latitude=17.445376&longitude=78.346144')
        assert response.status_code == 503
        assert response.json() == {'code': 'MONGO_SETUP_INCOMPLETE'}
        apply_schema(db.mongo)
        response = client.get('/api/v1/nurses/nearby?latitude=17.445376&longitude=78.346144')
        assert response.status_code == 200 and response.json()['items'] == []
    finally:
        apply_schema(db.mongo)


def test_map_selects_location_when_another_geo_index_exists(client, database):
    db, _ = database
    name = db.mongo.NursePings.create_index([('secondary_location', '2dsphere')])
    try:
        response = client.get('/api/v1/nurses/nearby?latitude=17.445376&longitude=78.346144')
        assert response.status_code == 200
    finally:
        db.mongo.NursePings.drop_index(name)
