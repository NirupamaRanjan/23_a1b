"""Append current demo telemetry without wiping reviews or catalogs; no HTTP write API."""
import sys
from pathlib import Path
from datetime import datetime,timezone
import random
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
load_dotenv(ROOT/'.env')
from app.config import Settings
settings=Settings()
if not settings.demo_mode:
    raise SystemExit('Fresh demo telemetry is disabled outside demo mode.')
with MongoClient(settings.mongo_uri) as client:
    db=client[settings.mongo_db]
    now=datetime.now(timezone.utc)
    rows=[{'nurse_id':i,'is_active':True,'created_at':now,
        'location':{'type':'Point','coordinates':[-73.98513+random.uniform(-0.025,0.025),40.748817+random.uniform(-0.025,0.025)]}}
        for i in range(1,51)]
    db.NursePings.insert_many(rows)
print('Added 50 fresh nurse pings. The map will pick them up on its next poll.')
