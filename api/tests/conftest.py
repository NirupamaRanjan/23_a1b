import os
import sys
from pathlib import Path
from urllib.parse import urlparse
import pytest
import psycopg2
from pymongo import MongoClient
from fastapi.testclient import TestClient
from app.config import Settings
from app.database import Database
from app.main import create_app

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent))

@pytest.fixture(scope='session')
def database():
    url=os.getenv('CARECONNECT_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Set CARECONNECT_TEST_DATABASE_URL to a disposable database ending in _test')
    if not urlparse(url).path.endswith('_test'):
        raise RuntimeError('Integration tests refuse to reset a database not ending in _test')
    settings=Settings(database_url=url,mongo_uri=os.getenv('CARECONNECT_TEST_MONGO_URI','mongodb://localhost:27017/'),
        mongo_db='medical_db_test',demo_mode=True)
    with psycopg2.connect(url) as connection:
        with connection.cursor() as cur:
            cur.execute("SELECT to_regclass('patients')")
            if cur.fetchone()[0] is None:
                for file in sorted((ROOT.parent/'sql').glob('*.sql')):
                    if file.name.startswith('06_'):continue
                    cur.execute(file.read_text())
    db=Database(settings)
    from mongo.setup import apply_schema
    apply_schema(db.mongo)
    yield db,settings
    db.close()

@pytest.fixture
def reset_data(database):
    db,_=database
    with db.cursor() as cur:
        cur.execute('ALTER TABLE wallet_audit_logs DISABLE TRIGGER USER')
        cur.execute('TRUNCATE api_sessions,api_booking_requests,appointments,wallet_audit_logs,patients,clinics RESTART IDENTITY CASCADE')
        cur.execute('ALTER TABLE wallet_audit_logs ENABLE TRIGGER USER')
        cur.execute("INSERT INTO patients(name,hsa_balance) VALUES ('Asha Rao',1000),('Rohan Mehta',1000),('Low balance',1)")
        cur.execute("INSERT INTO clinics(name,latitude,longitude,is_accepting_patients) VALUES ('Lakeview',40.748817,-73.98513,true),('Greenfield',40.75,-73.99,true),('Closed',40.7,-73.9,false)")
        cur.execute('SELECT refresh_clinic_monthly_discharges()')
        cur.execute('UPDATE api_refresh_metadata SET last_refreshed_at=NULL')
    for name in ('NursePings','PatientReviews','MedicalCatalogs'):
        db.mongo[name].delete_many({})

@pytest.fixture
def client(database):
    db,settings=database
    with TestClient(create_app(settings,db)) as client:
        payload=client.get('/api/v1/session').json()
        client.headers.update({'Origin':'http://localhost:5173','X-CSRF-Token':payload['csrf_token']})
        yield client


def switch(client,role,actor_id):
    response=client.post('/api/v1/session/actor',json={'role':role,'actor_id':actor_id})
    assert response.status_code==200,response.text
    client.headers['X-CSRF-Token']=response.json()['csrf_token']
    return response.json()
