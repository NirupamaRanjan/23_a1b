"""Geographic invariants for every synthetic location entry point."""
import random
import pytest
from data_generation import india_geography as geo
from data_generation import nurse_telemetry as telemetry


def test_clinics_and_nurse_walks_stay_inside_indian_service_areas():
    random.seed(2026)
    clinics = [(i+1, *geo.clinic_point(i)) for i in range(50)]
    assert len({geo.service_area(i)[1] for i in range(50)}) == 4
    assert all(geo.in_service_area(lat, lng) for _, lat, lng in clinics)
    for _, home in telemetry.nurse_homes(50, clinics):
        pos = home
        for _ in range(2000):
            pos = telemetry.step(*pos, *home)
            assert geo.in_service_area(*pos)
        row = telemetry.ping(1, 'Nurse', *pos, True, None)
        assert geo.in_service_area(*reversed(row['location']['coordinates']))


def test_foreign_legacy_inputs_and_fallbacks_cannot_emit_foreign_pings():
    random.seed(3)
    foreign = [(1, 40.748817, -73.98513), (2, float('nan'), 78)]
    for _, home in telemetry.nurse_homes(100, foreign):
        assert geo.in_service_area(*home)
    assert geo.in_service_area(*telemetry.step(40, -74, 40, -74))
    assert geo.in_service_area(*geo.random_point_near(40, -74, 5000))
    with pytest.raises(ValueError, match='Indian service area'):
        telemetry.ping(1, 'Nurse', 40, -74, True, None)
    assert not geo.in_service_area(float('nan'), 78)
    assert not geo.in_service_area(17, float('inf'))


def test_service_area_edges_reject_outward_generated_points():
    random.seed(9)
    for _, _, lat, lng in geo.SERVICE_AREAS:
        edge = geo.raw_move(lat, lng, geo.SERVICE_RADIUS_M-1, 90)
        for _ in range(50):
            assert geo.in_service_area(*geo.random_point_near(*edge, 10000))
            assert geo.in_service_area(*telemetry.move(*edge, 10000, 90))


@pytest.mark.usefixtures('reset_data')
def test_location_migration_preserves_business_data_and_is_idempotent(database):
    import psycopg2
    from datetime import datetime, timezone
    from data_generation.relocate_india import relocate
    db, settings = database
    mongo = db.mongo
    mongo.Nurses.delete_many({})
    mongo.Nurses.insert_one({'nurse_id': 101, 'name': 'Keep this name', 'clinic_id': 1,
                            'home': {'type': 'Point', 'coordinates': [-74, 40]}})
    stamp = datetime.now(timezone.utc).replace(microsecond=0)
    mongo.NursePings.insert_one({'nurse_id': 101, 'active': False, 'name': 'Keep this name',
                                'location': {'type': 'Point', 'coordinates': [-74, 40]}, 'created_at': stamp})
    original_ping = mongo.NursePings.find_one({'nurse_id': 101})
    with db.cursor() as cur:
        cur.execute("INSERT INTO appointments(patient_id,clinic_id,copay_amount,status) VALUES(1,1,10,'DISCHARGED')")
        cur.execute('UPDATE patients SET hsa_balance=hsa_balance+5 WHERE id=1')
    with db.cursor(readonly=True) as cur:
        cur.execute('SELECT * FROM patients ORDER BY id'); patients = cur.fetchall()
        cur.execute('SELECT * FROM clinics ORDER BY id'); clinics = cur.fetchall()
        cur.execute('SELECT * FROM appointments ORDER BY id'); appointments = cur.fetchall()
        cur.execute('SELECT * FROM wallet_audit_logs ORDER BY id'); audit = cur.fetchall()
    with psycopg2.connect(settings.database_url) as connection:
        preview = relocate(connection, mongo)
        assert preview == {'clinic_locations': 3, 'nurse_homes': 1, 'nurse_pings': 1}
        assert mongo.NursePings.find_one({'nurse_id': 101}) == original_ping
        with db.cursor(readonly=True) as cur:
            cur.execute('SELECT * FROM clinics ORDER BY id'); assert cur.fetchall() == clinics
        assert relocate(connection, mongo, apply=True) == preview
        assert relocate(connection, mongo, apply=True) == {'clinic_locations': 0, 'nurse_homes': 0, 'nurse_pings': 0}
    with db.cursor(readonly=True) as cur:
        cur.execute('SELECT * FROM patients ORDER BY id'); assert cur.fetchall() == patients
        cur.execute('SELECT * FROM appointments ORDER BY id'); assert cur.fetchall() == appointments
        cur.execute('SELECT * FROM wallet_audit_logs ORDER BY id'); assert cur.fetchall() == audit
        cur.execute('SELECT * FROM clinics ORDER BY id'); relocated_clinics = cur.fetchall()
    for original, changed in zip(clinics, relocated_clinics):
        assert {k:v for k,v in original.items() if k not in ('latitude','longitude')} == {k:v for k,v in changed.items() if k not in ('latitude','longitude')}
        assert geo.in_service_area(changed['latitude'], changed['longitude'])
    relocated_ping = mongo.NursePings.find_one({'nurse_id': 101})
    assert {k:v for k,v in relocated_ping.items() if k != 'location'} == {k:v for k,v in original_ping.items() if k != 'location'}
    assert geo.in_service_area(*reversed(relocated_ping['location']['coordinates']))
    from data_generation.fresh_pings import load_state, add_round
    state = load_state(mongo)
    assert all(geo.in_service_area(*n['home']) and geo.in_service_area(*n['pos']) for n in state)
    add_round(mongo, state)
    assert all(geo.in_service_area(*reversed(p['location']['coordinates'])) for p in mongo.NursePings.find({}))
    mongo.Nurses.delete_many({})
