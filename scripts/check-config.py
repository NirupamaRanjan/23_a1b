"""Validate local configuration without printing connection strings or credentials."""
import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'api'))
sys.path.insert(0,str(ROOT))
from app.config import Settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--connect',action='store_true',help='Check PostgreSQL and MongoDB connectivity too')
    parser.add_argument('--schema', action='store_true', help='Also verify medical_db collections, validators and indexes')
    args = parser.parse_args()
    settings = Settings()
    url = urlparse(settings.database_url)
    if url.scheme not in ('postgres','postgresql') or not url.hostname or not url.path.strip('/'):
        raise SystemExit('DATABASE_URL must specify a PostgreSQL host and database.')
    if 'CHANGE_ME' in settings.database_url:
        raise SystemExit('Edit your active .env; replace the example database password first.')
    print('Configuration format: OK. Connection strings are hidden.')
    if args.connect or args.schema:
        import psycopg2
        from pymongo import MongoClient
        try:
            with psycopg2.connect(settings.database_url,connect_timeout=5) as connection:
                with connection.cursor() as cursor:cursor.execute('SELECT 1')
            with MongoClient(settings.mongo_uri,serverSelectionTimeoutMS=5000,connectTimeoutMS=5000) as client:
                client.admin.command('ping')
                from mongo.setup import check_schema
                issues = check_schema(client[settings.mongo_db]) if args.schema else []
                if issues:
                    raise SystemExit('MongoDB schema/index setup is incomplete. Run python mongo/setup.py from the project root.')
        except Exception as error:
            # Driver errors may contain host/user names. Never echo the connection URI.
            raise SystemExit(f'Database connection check failed ({type(error).__name__}). Check services and credentials in your active .env.') from None
        print('PostgreSQL and MongoDB connections: OK. Database: medical_db.')


if __name__ == '__main__':
    main()
