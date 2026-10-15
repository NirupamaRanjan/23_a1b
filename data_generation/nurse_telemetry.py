"""Shared nurse-telemetry helpers for mongo_seeder.py and data_generation/fresh_pings.py.

Every nurse has a home point near one of the clinics and moves in small steps around it, so
seeded clinics have nearby nurse telemetry. Active availability depends on the latest ping.
"""
import math
import random

try:
    from data_generation.india_geography import DEFAULT_CENTRE, in_service_area, random_point_near, distance_m, raw_move
except ImportError:
    from india_geography import DEFAULT_CENTRE, in_service_area, random_point_near, distance_m, raw_move

HOME_RADIUS_M = 2500     # nurses stay within this distance of their home point
STEP_M = 150             # maximum movement between two pings
ON_DUTY_SHARE = 0.7      # long-run share of nurses that are active (on duty)
METRES_PER_DEG_LAT = 111_320


def _metres_per_deg_lng(lat):
    return METRES_PER_DEG_LAT * math.cos(math.radians(lat))


def move(lat, lng, metres, bearing_deg):
    if not in_service_area(lat, lng):
        lat, lng = DEFAULT_CENTRE
    point = raw_move(lat, lng, metres, bearing_deg)
    return point if in_service_area(*point) else (float(lat), float(lng))


def clinic_locations():
    """[(clinic_id, latitude, longitude)] from PostgreSQL, or [] when it cannot be reached."""
    try:
        import psycopg2
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'api'))
        from app.config import Settings
        conn = psycopg2.connect(Settings().database_url, connect_timeout=5)
        with conn, conn.cursor() as cur:
            cur.execute("SELECT id, latitude, longitude FROM clinics ORDER BY id")
            rows = cur.fetchall()
        conn.close()
        return [(row[0], float(row[1]), float(row[2])) for row in rows if in_service_area(row[1], row[2])]
    except Exception as error:  # the seeder still works without PostgreSQL
        print(f"Clinic locations unavailable ({type(error).__name__}); using the default area.")
        return []


def nurse_homes(count, clinics):
    """Assign nurses to clinics round-robin; home = random point within 1.2 km of the clinic."""
    clinics = [c for c in clinics if in_service_area(c[1], c[2])]
    homes = []
    for i in range(count):
        if clinics:
            clinic_id, lat, lng = clinics[i % len(clinics)]
            home = random_point_near(lat, lng, 1200)
        else:
            clinic_id = None
            home = random_point_near(*DEFAULT_CENTRE, 1200)
        homes.append((clinic_id, home))
    return homes


def step(lat, lng, home_lat, home_lng):
    """One movement step; drifts back towards home when near the edge of its area."""
    if not in_service_area(home_lat, home_lng):
        home_lat, home_lng = DEFAULT_CENTRE
    if not in_service_area(lat, lng):
        lat, lng = home_lat, home_lng
    if distance_m(lat, lng, home_lat, home_lng) > HOME_RADIUS_M:
        bearing = math.degrees(math.atan2(
            (home_lng - lng) * _metres_per_deg_lng(lat), (home_lat - lat) * METRES_PER_DEG_LAT))
    else:
        bearing = random.uniform(0, 360)
    return move(lat, lng, random.uniform(20, STEP_M), bearing)


def next_duty(active, flip_rate=0.05):
    """Occasionally start or end a shift while keeping about ON_DUTY_SHARE on duty."""
    if active:
        return random.random() >= flip_rate * (1 - ON_DUTY_SHARE) / ON_DUTY_SHARE
    return random.random() < flip_rate


def ping(nurse_id, name, lat, lng, active, created_at):
    if not in_service_area(lat, lng):
        raise ValueError('Generated nurse coordinates must be inside an Indian service area')
    row = {
        "nurse_id": nurse_id,
        "is_active": active,
        "location": {"type": "Point", "coordinates": [lng, lat]},   # GeoJSON: [longitude, latitude]
        "created_at": created_at,
    }
    if name:
        row["nurse_name"] = name
    return row
