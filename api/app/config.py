import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent


def load_settings_env():
    """Use the documented root .env, falling back to the previous api/.env layout.

    Exported environment variables always win (Docker and disposable tests).
    Both entry points use the same explicit file, independently of working directory.
    """
    root_env = REPO_ROOT / '.env'
    api_env = API_ROOT / '.env'
    load_dotenv(root_env if root_env.is_file() else api_env, override=False)


load_settings_env()


def database_url_from_environment():
    explicit = os.getenv('DATABASE_URL')
    if explicit:
        return explicit
    host = os.getenv('PGHOST', 'localhost')
    if ':' in host and not host.startswith('['):
        host = f'[{host}]'
    user = quote(os.getenv('PGUSER', 'postgres'), safe='')
    password = quote(os.getenv('PGPASSWORD', 'postgres'), safe='')
    name = quote(os.getenv('PGDATABASE', 'careconnect'), safe='')
    port = os.getenv('PGPORT', '5432')
    return f'postgresql://{user}:{password}@{host}:{port}/{name}'


def mongo_database_from_environment():
    name = os.getenv('CARECONNECT_MONGO_DB', 'medical_db')
    if name != 'medical_db':
        raise ValueError('Set CARECONNECT_MONGO_DB=medical_db in the active .env; no other runtime MongoDB database is supported.')
    return name


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=database_url_from_environment)
    mongo_uri: str = field(default_factory=lambda: os.getenv(
        'CARECONNECT_MONGO_URI', 'mongodb://localhost:27017/'))
    mongo_db: str = field(default_factory=lambda: mongo_database_from_environment())
    demo_mode: bool = field(default_factory=lambda: os.getenv('CARECONNECT_DEMO_MODE', 'false').lower() == 'true')
    cookie_secure: bool = field(default_factory=lambda: os.getenv('CARECONNECT_COOKIE_SECURE', 'false').lower() == 'true')
    allowed_origins: tuple = field(default_factory=lambda: tuple(
        origin.strip() for origin in os.getenv('CARECONNECT_ALLOWED_ORIGINS',
            'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080').split(',')
        if origin.strip()))
    session_hours: int = 8
