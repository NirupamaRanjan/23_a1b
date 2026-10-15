from app.config import Settings


def test_settings_read_the_current_environment(monkeypatch):
    monkeypatch.setenv('CARECONNECT_MONGO_DB','careconnect_a2')
    monkeypatch.setenv('CARECONNECT_DEMO_MODE','true')
    monkeypatch.setenv('CARECONNECT_ALLOWED_ORIGINS','http://localhost:5173, http://127.0.0.1:5173 ,')
    settings = Settings()
    assert settings.mongo_db == 'careconnect_a2'
    assert settings.demo_mode is True
    assert settings.allowed_origins == ('http://localhost:5173','http://127.0.0.1:5173')


def test_docker_connection_fields_encode_special_password_characters(monkeypatch):
    from urllib.parse import urlparse, unquote
    monkeypatch.delenv('DATABASE_URL', raising=False)
    for key, value in {'PGHOST':'postgres', 'PGPORT':'5432', 'PGDATABASE':'careconnect',
                       'PGUSER':'postgres', 'PGPASSWORD':'a@b:c/#?% space'}.items():
        monkeypatch.setenv(key,value)
    parsed = urlparse(Settings().database_url)
    assert parsed.hostname == 'postgres'
    assert unquote(parsed.password) == 'a@b:c/#?% space'
    assert parsed.path == '/careconnect'


def test_explicit_database_url_has_priority(monkeypatch):
    monkeypatch.setenv('DATABASE_URL','postgresql://example@localhost:5432/existing')
    monkeypatch.setenv('PGDATABASE','another')
    assert Settings().database_url == 'postgresql://example@localhost:5432/existing'


def test_mongo_database_defaults_to_careconnect_a2(monkeypatch):
    monkeypatch.delenv('CARECONNECT_MONGO_DB', raising=False)
    assert Settings().mongo_db == 'careconnect_a2'


def test_an_old_mongo_database_setting_is_rejected(monkeypatch):
    import pytest
    monkeypatch.setenv('CARECONNECT_MONGO_DB', 'careconnect')
    with pytest.raises(ValueError, match='careconnect_a2'):
        Settings()


def test_mongo_operation_failures_have_specific_public_categories():
    from pymongo.errors import OperationFailure
    from app.errors import translate_mongo
    cases = [(13, 'MONGO_PERMISSION_DENIED', 503), (18, 'MONGO_AUTH_FAILED', 503),
             (27, 'MONGO_SETUP_INCOMPLETE', 503), (168, 'MONGO_VERSION_UNSUPPORTED', 503),
             (2, 'MONGO_QUERY_FAILED', 500)]
    for code, expected, status in cases:
        error = translate_mongo(OperationFailure('private server detail', code=code))
        assert (error.code, error.status) == (expected, status)
