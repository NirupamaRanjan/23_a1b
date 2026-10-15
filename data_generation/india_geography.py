"""Conservative inland demo service areas, all wholly inside India.

This is an allow-list of small inland circles, not a country bounding rectangle.
It intentionally covers a subset of India: Hyderabad/Telangana and nearby states.
A browser's real location is never clamped to these synthetic-data service areas.
"""
import math
import random

# (city, state, latitude, longitude). Circles are only 20 km wide in radius and
# deliberately far from international boundaries and the coast.
SERVICE_AREAS = (
    ('Hyderabad', 'Telangana', 17.445376, 78.346144),
    ('Warangal', 'Telangana', 17.9689, 79.5941),
    ('Karimnagar', 'Telangana', 18.4386, 79.1288),
    ('Nizamabad', 'Telangana', 18.6725, 78.0941),
    ('Khammam', 'Telangana', 17.2473, 80.1514),
    ('Kurnool', 'Andhra Pradesh', 15.8281, 78.0373),
    ('Vijayawada', 'Andhra Pradesh', 16.5062, 80.6480),
    ('Tirupati', 'Andhra Pradesh', 13.6288, 79.4192),
    ('Bengaluru', 'Karnataka', 12.9716, 77.5946),
    ('Belagavi', 'Karnataka', 15.8497, 74.4977),
    ('Pune', 'Maharashtra', 18.5204, 73.8567),
    ('Nagpur', 'Maharashtra', 21.1458, 79.0882),
)
DEFAULT_CENTRE = SERVICE_AREAS[0][2:]
EARTH_RADIUS_M = 6371008.8
SERVICE_RADIUS_M = 20000


def distance_m(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = p2-p1, math.radians(lng2-lng1)
    a = math.sin(dlat/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlng/2)**2
    return 2*EARTH_RADIUS_M*math.asin(min(1, math.sqrt(max(0, a))))


def in_service_area(lat, lng):
    try:
        lat, lng = float(lat), float(lng)
        return (math.isfinite(lat) and math.isfinite(lng) and
                any(distance_m(lat, lng, a[2], a[3]) <= SERVICE_RADIUS_M for a in SERVICE_AREAS))
    except (TypeError, ValueError):
        return False


def service_area(index):
    # Half the clinics/nurses are in Hyderabad; the remainder cover the other areas.
    return SERVICE_AREAS[0] if index % 2 == 0 else SERVICE_AREAS[1 + (index//2) % (len(SERVICE_AREAS)-1)]


def raw_move(lat, lng, metres, bearing_deg):
    p, l = math.radians(lat), math.radians(lng)
    angle, bearing = metres/EARTH_RADIUS_M, math.radians(bearing_deg)
    p2 = math.asin(math.sin(p)*math.cos(angle) + math.cos(p)*math.sin(angle)*math.cos(bearing))
    l2 = l + math.atan2(math.sin(bearing)*math.sin(angle)*math.cos(p), math.cos(angle)-math.sin(p)*math.sin(p2))
    return math.degrees(p2), (math.degrees(l2)+180) % 360-180


def random_point_near(lat, lng, max_m):
    """Generate only inside approved Indian service areas, even for a foreign input."""
    if not in_service_area(lat, lng):
        lat, lng = DEFAULT_CENTRE
    if not math.isfinite(max_m) or max_m < 0:
        raise ValueError('Distance must be finite and nonnegative')
    for _ in range(100):
        point = raw_move(lat, lng, min(max_m, SERVICE_RADIUS_M)*math.sqrt(random.random()), random.uniform(0, 360))
        if in_service_area(*point):
            return point
    return float(lat), float(lng)


def clinic_point(index):
    area = service_area(index)
    return random_point_near(area[2], area[3], 1200)
