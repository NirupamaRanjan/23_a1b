"""Move existing demo locations into Indian service areas without reseeding business data.

    python data_generation/relocate_india.py          # read-only preview
    python data_generation/relocate_india.py --apply  # update locations only

IDs, names, nurse duty, timestamps, patients, appointments, wallet history, reviews and
catalogs are preserved. Old pings are not made current; use real telemetry or the demo
fresh_pings.py loop for new pings. Run while the demo telemetry loop is stopped.
"""
import argparse
import random
import sys
from pathlib import Path
import psycopg2
from pymongo import MongoClient, UpdateOne

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT/'api'))
from app.config import Settings
from data_generation.india_geography import clinic_point, in_service_area, random_point_near, DEFAULT_CENTRE


def valid_geo(point):
    try:
        lng, lat = point['coordinates']
        return in_service_area(lat, lng)
    except (TypeError, KeyError, ValueError):
        return False


def relocate(connection, db, apply=False):
    """Preview or idempotently repair coordinates only in the existing stores."""
    random.seed(2026)
    report = {'clinic_locations': 0, 'nurse_homes': 0, 'nurse_pings': 0}
    clinics = {}
    with connection.cursor() as cur:
        cur.execute('SELECT id,latitude,longitude FROM clinics ORDER BY id')
        for index, (clinic_id, lat, lng) in enumerate(cur.fetchall()):
            if not in_service_area(lat, lng):
                lat, lng = clinic_point(index)
                report['clinic_locations'] += 1
                if apply:
                    cur.execute('UPDATE clinics SET latitude=%s,longitude=%s WHERE id=%s', (lat, lng, clinic_id))
            clinics[clinic_id] = (float(lat), float(lng))
    homes = {}
    # This collection already belongs to the uploaded project; no new collection is created.
    if 'Nurses' in db.list_collection_names():
        for nurse in db.Nurses.find({}, {'nurse_id': 1, 'home': 1, 'clinic_id': 1}):
            home = nurse.get('home')
            if valid_geo(home):
                lng, lat = home['coordinates']
            else:
                centre = clinics.get(nurse.get('clinic_id'), DEFAULT_CENTRE)
                lat, lng = random_point_near(*centre, 1200)
                report['nurse_homes'] += 1
                if apply:
                    db.Nurses.update_one({'_id': nurse['_id']}, {'$set': {
                        'home': {'type': 'Point', 'coordinates': [lng, lat]}}})
            homes[nurse['nurse_id']] = (lat, lng)
    operations = []
    for ping in db.NursePings.find({}, {'nurse_id': 1, 'location': 1}):
        if valid_geo(ping.get('location')):
            continue
        centre = homes.get(ping.get('nurse_id'), DEFAULT_CENTRE)
        lat, lng = random_point_near(*centre, 1500)
        report['nurse_pings'] += 1
        if apply:
            operations.append(UpdateOne({'_id': ping['_id']}, {'$set': {
                'location': {'type': 'Point', 'coordinates': [lng, lat]}}}))
            if len(operations) >= 2000:
                db.NursePings.bulk_write(operations, ordered=False)
                operations = []
    if operations:
        db.NursePings.bulk_write(operations, ordered=False)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--apply', action='store_true', help='Apply the location changes shown in the preview')
    args = parser.parse_args()
    settings = Settings()
    if not settings.demo_mode:
        raise SystemExit('Demo location migration requires CARECONNECT_DEMO_MODE=true.')
    with psycopg2.connect(settings.database_url) as connection, MongoClient(settings.mongo_uri) as client:
        result = relocate(connection, client[settings.mongo_db], args.apply)
    print('Updated locations:' if args.apply else 'Preview only; no writes. Locations to update:', result)
    print('Patient, appointment, balance and audit records were not changed.')


if __name__ == '__main__':
    main()
