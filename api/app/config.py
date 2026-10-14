import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/careconnect')
    mongo_uri: str = os.getenv('CARECONNECT_MONGO_URI', 'mongodb://localhost:27017/')
    mongo_db: str = os.getenv('CARECONNECT_MONGO_DB', 'careconnect')
    demo_mode: bool = os.getenv('CARECONNECT_DEMO_MODE', 'false').lower() == 'true'
    cookie_secure: bool = os.getenv('CARECONNECT_COOKIE_SECURE', 'false').lower() == 'true'
    allowed_origins: tuple = tuple(os.getenv('CARECONNECT_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080').split(','))
    session_hours: int = 8
