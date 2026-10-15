from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from bson import ObjectId
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from pymongo import MongoClient


def transport(value, depth=0):
    """Keep decimal account amounts exact and adapt flexible BSON safely."""
    if depth > 20:
        return '[Maximum document depth]'
    if isinstance(value, Decimal):
        return format(value, '.2f')
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {str(k): transport(v, depth + 1) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [transport(v, depth + 1) for v in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


class Database:
    def __init__(self, settings):
        self.pool = ThreadedConnectionPool(1, 16, settings.database_url,
            connect_timeout=5, options='-c timezone=UTC -c statement_timeout=15000 -c lock_timeout=5000')
        self.mongo_client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000, socketTimeoutMS=15000, tz_aware=True)
        self.mongo = self.mongo_client[settings.mongo_db]

    @contextmanager
    def cursor(self, readonly=False):
        connection = self.pool.getconn()
        try:
            connection.set_session(readonly=readonly)
            with connection:
                with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                    yield cursor
        finally:
            # A dropped connection must not mask the original failure or re-enter the pool.
            broken = bool(connection.closed)
            if not broken:
                try:
                    connection.rollback()
                    connection.set_session(readonly=False)
                except psycopg2.Error:
                    broken = True
            self.pool.putconn(connection, close=broken)

    def close(self):
        self.pool.closeall()
        self.mongo_client.close()
