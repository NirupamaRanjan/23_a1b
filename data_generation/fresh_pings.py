"""Live nurse-telemetry simulator for demos (no HTTP write API).

Adds one current ping for every nurse in the Nurses directory, each a small move from that
nurse's last position, with about 70% of nurses on duty. Reviews and catalogs are untouched.

    python data_generation/fresh_pings.py              # one round
    python data_generation/fresh_pings.py --loop 30    # a new round every 30 seconds (Ctrl+C stops)
"""
import argparse
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from pymongo import MongoClient

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / 'api'
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(REPO))
# app.config loads the same .env file used by the API and bootstrap.
from app.config import Settings
from mongo.setup import apply_schema
from data_generation import nurse_telemetry as telemetry


def load_state(db):
    """Each nurse's home and last known position/duty (from its latest ping, if any)."""
    nurses = list(db.Nurses.find({}, {'_id': 0}))
    if not nurses:
        # Data seeded before the Nurses directory existed: simulate 50 unnamed nurses.
        print('No Nurses directory found; reseed MongoDB for named nurses around every clinic.')
        homes = telemetry.nurse_homes(50, telemetry.clinic_locations())
        nurses = [{'nurse_id': i, 'name': None, 'home': {'type': 'Point', 'coordinates': [lng, lat]}}
                  for i, (_, (lat, lng)) in enumerate(homes, start=1)]
    state = []
    for nurse in nurses:
        home_lng, home_lat = nurse['home']['coordinates']
        if not telemetry.in_service_area(home_lat, home_lng):
            home_lat, home_lng = telemetry.DEFAULT_CENTRE
        latest = db.NursePings.find_one({'nurse_id': nurse['nurse_id']},
                                        sort=[('created_at', -1), ('_id', -1)])
        if latest:
            lng, lat = latest['location']['coordinates']
            active = latest.get('is_active', latest.get('active', False))
            if not telemetry.in_service_area(lat, lng):
                lat, lng = home_lat, home_lng
        else:
            lat, lng = telemetry.random_point_near(home_lat, home_lng, telemetry.HOME_RADIUS_M)
            active = random.random() < telemetry.ON_DUTY_SHARE
        state.append({'id': nurse['nurse_id'], 'name': nurse.get('name', nurse.get('nurse_name')), 'home': (home_lat, home_lng),
                      'pos': (lat, lng), 'active': active})
    return state


def add_round(db, state):
    now = datetime.now(timezone.utc)
    rows = []
    for nurse in state:
        nurse['active'] = telemetry.next_duty(nurse['active'])
        nurse['pos'] = telemetry.step(*nurse['pos'], *nurse['home'])
        rows.append(telemetry.ping(nurse['id'], nurse['name'], *nurse['pos'], nurse['active'], now))
    db.NursePings.insert_many(rows)
    active = sum(1 for nurse in state if nurse['active'])
    print(f'{now:%H:%M:%S} UTC  added {len(rows)} pings ({active} nurses on duty). '
          'The map picks them up on its next poll.')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--loop', type=int, metavar='SECONDS',
                        help='keep adding a round every SECONDS seconds until stopped')
    args = parser.parse_args()
    if args.loop is not None and args.loop < 5:
        parser.error('--loop must be at least 5 seconds')
    settings = Settings()
    if not settings.demo_mode:
        raise SystemExit('Fresh demo telemetry is disabled outside demo mode.')
    with MongoClient(settings.mongo_uri) as client:
        db = client[settings.mongo_db]
        apply_schema(db)
        state = load_state(db)
        add_round(db, state)
        while args.loop:
            try:
                time.sleep(max(args.loop, 5))
                add_round(db, state)
            except KeyboardInterrupt:
                print('Stopped.')
                break


if __name__ == '__main__':
    main()
