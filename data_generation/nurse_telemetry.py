"""Shared nurse-telemetry helpers for mongo_seeder.py and api/scripts/fresh_pings.py.

Every nurse has a home point near one of the clinics and moves in small steps around it, so
any origin inside the service area (and every clinic) has nurses within the 5 km search radius.
"""
import math
import os
import random

# Fallback service area (midtown Manhattan) when clinic locations cannot be read from PostgreSQL.
DEFAULT_CENTRE = (40.748817, -73.985130)   # (latitude, longitude)
DEFAULT_SPREAD_DEG = 0.05

HOME_RADIUS_M = 2500     # nurses stay within this distance of their home point
STEP_M = 150             # maximum movement between two pings
ON_DUTY_SHARE = 0.7      # long-run share of nurses that are active (on duty)
METRES_PER_DEG_LAT = 111_320


def _metres_per_deg_lng(lat):
    return METRES_PER_DEG_LAT * math.cos(math.radians(lat))


def distance_m(lat1, lng1, lat2, lng2):
    """Small-distance approximation, accurate enough for a few kilometres."""
    dy = (lat2 - lat1) * METRES_PER_DEG_LAT
    dx = (lng2 - lng1) * _metres_per_deg_lng((lat1 + lat2) / 2)
    return math.hypot(dx, dy)


def move(lat, lng, metres, bearing_deg):
    bearing = math.radians(bearing_deg)
    return (lat + metres * math.cos(bearing) / METRES_PER_DEG_LAT,
            lng + metres * math.sin(bearing) / _metres_per_deg_lng(lat))


def random_point_near(lat, lng, max_m):
    """Uniformly distributed point within max_m metres."""
    return move(lat, lng, max_m * math.sqrt(random.random()), random.uniform(0, 360))


def clinic_locations():
    """[(clinic_id, latitude, longitude)] from PostgreSQL, or [] when it cannot be reached."""
    try:
        import psycopg2
        url = os.getenv("DATABASE_URL")
        if url:
            conn = psycopg2.connect(url, connect_timeout=5)
        else:
            conn = psycopg2.connect(
                dbname=os.getenv("CARECONNECT_DB_NAME", "careconnect"),
                user=os.getenv("CARECONNECT_DB_USER", "postgres"),
                password=os.getenv("CARECONNECT_DB_PASSWORD"),
                host=os.getenv("CARECONNECT_DB_HOST", "localhost"),
                port=os.getenv("CARECONNECT_DB_PORT", "5432"),
                connect_timeout=5)
        with conn, conn.cursor() as cur:
            cur.execute("SELECT id, latitude, longitude FROM clinics ORDER BY id")
            rows = cur.fetchall()
        conn.close()
        return [(row[0], float(row[1]), float(row[2])) for row in rows]
    except Exception as error:  # the seeder still works without PostgreSQL
        print(f"Clinic locations unavailable ({type(error).__name__}); using the default area.")
        return []


def nurse_homes(count, clinics):
    """Assign nurses to clinics round-robin; home = random point within 3 km of the clinic."""
    homes = []
    for i in range(count):
        if clinics:
            clinic_id, lat, lng = clinics[i % len(clinics)]
            home = random_point_near(lat, lng, 3000)
        else:
            clinic_id = None
            home = (DEFAULT_CENTRE[0] + random.uniform(-DEFAULT_SPREAD_DEG, DEFAULT_SPREAD_DEG),
                    DEFAULT_CENTRE[1] + random.uniform(-DEFAULT_SPREAD_DEG, DEFAULT_SPREAD_DEG))
        homes.append((clinic_id, home))
    return homes


def step(lat, lng, home_lat, home_lng):
    """One movement step; drifts back towards home when near the edge of its area."""
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
    row = {
        "nurse_id": nurse_id,
        "is_active": active,
        "location": {"type": "Point", "coordinates": [lng, lat]},   # GeoJSON: [longitude, latitude]
        "created_at": created_at,
    }
    if name:
        row["nurse_name"] = name
    return row
