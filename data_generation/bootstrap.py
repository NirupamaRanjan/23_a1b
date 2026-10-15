"""Install root-owned schemas and seed only empty demo stores. Run from the project root."""
import os
import sys
from pathlib import Path
import psycopg2
from pymongo import MongoClient

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / 'api'
sys.path.insert(0,str(ROOT))                        # lets "from app..." work
sys.path.insert(0,str(REPO))                        # lets "from data_generation..." work
# app.config loads the shared root .env (or the older api/.env) explicitly.

def bootstrap():
    from app.config import Settings
    from mongo.setup import apply_schema
    settings = Settings()
    with psycopg2.connect(settings.database_url) as connection:
        with connection.cursor() as cur:
            cur.execute("SELECT to_regclass('patients')")
            fresh = cur.fetchone()[0] is None
            if fresh:
                for path in sorted((REPO/'sql').glob('0[1-5]_*.sql')):
                    cur.execute(path.read_text())
            cur.execute((REPO/'sql/07_api_support.sql').read_text())
            # A partially populated store must never trigger the destructive demo seeder.
            cur.execute('''SELECT NOT EXISTS (SELECT 1 FROM patients)
                AND NOT EXISTS (SELECT 1 FROM clinics)
                AND NOT EXISTS (SELECT 1 FROM appointments)
                AND NOT EXISTS (SELECT 1 FROM wallet_audit_logs)''')
            seed_postgres = cur.fetchone()[0]
    # Original seeders remain available. Auto seeding never resets an existing store.
    if seed_postgres:
        from urllib.parse import urlparse,unquote
        parsed = urlparse(settings.database_url)
        os.environ.update(CARECONNECT_DB_NAME=unquote(parsed.path.lstrip('/')),
            CARECONNECT_DB_USER=unquote(parsed.username or 'postgres'),
            CARECONNECT_DB_PASSWORD=unquote(parsed.password or ''),
            CARECONNECT_DB_HOST=parsed.hostname or 'localhost',CARECONNECT_DB_PORT=str(parsed.port or 5432))
        from data_generation.postgres_seeder import seed
        seed()
        from app.database import Database
        from app.services import AnalyticsService
        db = Database(settings)
        try:
            AnalyticsService(db).refresh()
        finally:
            db.close()
    client = MongoClient(settings.mongo_uri,serverSelectionTimeoutMS=5000)
    db = client[settings.mongo_db]
    apply_schema(db)
    if all(db[name].count_documents({}) == 0
           for name in ('Nurses', 'NursePings', 'PatientReviews', 'MedicalCatalogs')):
        from data_generation.mongo_seeder import seed as seed_mongo
        os.environ['CARECONNECT_MONGO_URI'] = settings.mongo_uri
        os.environ['CARECONNECT_MONGO_DB'] = settings.mongo_db
        seed_mongo()
    client.close()
    print('CareConnect bootstrap complete. Existing data was preserved.')

if __name__=='__main__':
    bootstrap()
