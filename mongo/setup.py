"""Apply/check the root MongoDB schema without deleting collections or documents."""
import argparse
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import CollectionInvalid

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads(Path(__file__).with_name('schema.json').read_text())


def mongo_environment():
    root_env = ROOT / '.env'
    load_dotenv(root_env if root_env.is_file() else ROOT / 'api/.env', override=False)
    name = os.getenv('CARECONNECT_MONGO_DB', SCHEMA['database'])
    if name != SCHEMA['database']:
        raise ValueError('Set CARECONNECT_MONGO_DB=medical_db in the active .env and remove any conflicting exported value.')
    return os.getenv('CARECONNECT_MONGO_URI', 'mongodb://localhost:27017/'), name


def apply_schema(db):
    """Canonical validators and indexes; db may be an explicitly isolated test database."""
    existing = set(db.list_collection_names())
    for name, definition in SCHEMA['collections'].items():
        options = {'validator': {'$jsonSchema': definition['schema']},
                   'validationLevel': 'strict', 'validationAction': 'error'}
        if name not in existing:
            try:
                db.create_collection(name, **options)
            except CollectionInvalid:
                db.command({'collMod': name, **options})
        else:
            db.command({'collMod': name, **options})
        for index in definition['indexes']:
            db[name].create_index([tuple(key) for key in index['keys']], **index.get('options', {}))


def check_schema(db):
    """Return missing schema/index requirements; this check never writes data."""
    issues = []
    existing = {row['name']: row for row in db.list_collections()}
    for name, definition in SCHEMA['collections'].items():
        if name not in existing:
            issues.append(f'{name}: collection missing')
            continue
        if existing[name].get('options', {}).get('validator') != {'$jsonSchema': definition['schema']}:
            issues.append(f'{name}: validator missing or outdated')
        indexes = list(db[name].list_indexes())
        for wanted in definition['indexes']:
            matches = [row for row in indexes if list(row['key'].items()) == [tuple(key) for key in wanted['keys']]]
            if not any(all(row.get(key) == value for key, value in wanted.get('options', {}).items()) for row in matches):
                issues.append(f'{name}: index missing or options differ: {wanted["keys"]}')
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only verification, no setup or seeding')
    args = parser.parse_args()
    uri, name = mongo_environment()
    with MongoClient(uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000) as client:
        client.admin.command('ping')
        print(f'MongoDB {client.server_info()["version"]}; database: {name}')
        db = client[name]
        if not args.check:
            apply_schema(db)
        issues = check_schema(db)
        for issue in issues:
            print(issue)
        if issues:
            raise SystemExit('Setup incomplete. Run python mongo/setup.py from the project root.')
        print('Collections, validators and indexes: OK. Existing documents preserved.')


if __name__ == '__main__':
    main()
