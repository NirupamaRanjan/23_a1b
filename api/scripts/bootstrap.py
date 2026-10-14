"""Install SQL additions and seed only fresh demo stores. Run from the api directory."""
import os
import sys
from pathlib import Path
import psycopg2
from pymongo import MongoClient
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent      # api/
REPO = ROOT.parent                                  # repo root: sql/, mongo/, data_generation/
sys.path.insert(0,str(ROOT))                        # lets "from app..." work
sys.path.insert(0,str(REPO))                        # lets "from data_generation..." work
load_dotenv(REPO/'.env')                            # the shared root .env

def bootstrap():
    from app.config import Settings
    settings = Settings()
    with psycopg2.connect(settings.database_url) as connection:
        with connection.cursor() as cur:
            cur.execute("SELECT to_regclass('patients')")
            fresh = cur.fetchone()[0] is None
            if fresh:
                for path in sorted((REPO/'sql').glob('0[1-5]_*.sql')):
                    cur.execute(path.read_text())
            cur.execute((REPO/'sql/07_api_support.sql').read_text())
            cur.execute('SELECT COUNT(*) FROM patients')
            seed_postgres = cur.fetchone()[0]==0
    # Original seeders remain available. Auto seeding never resets an existing store.
    if seed_postgres:
        from urllib.parse import urlparse,unquote
        parsed = urlparse(settings.database_url)
        os.environ.update(CARECONNECT_DB_NAME=parsed.path.lstrip('/'),
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
    if not db.PatientReviews.count_documents({}) and not db.NursePings.count_documents({}) and not db.MedicalCatalogs.count_documents({}):
        from data_generation.mongo_seeder import seed as seed_mongo
        seed_mongo()
    client.close()
    print('CareConnect bootstrap complete. Existing data was preserved.')

if __name__=='__main__':
    bootstrap()
