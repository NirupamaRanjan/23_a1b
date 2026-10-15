class PublicError(Exception):
    def __init__(self, code, status=400):
        self.code = code
        self.status = status


def translate_postgres(error):
    """Database messages are inspected internally and never returned to clients."""
    message = str(error)
    code = error.pgcode
    if code == '23505' and getattr(error.diag, 'constraint_name', '') == 'idx_active_consult':
        return PublicError('ACTIVE_VISIT_EXISTS', 409)
    if 'Insufficient HSA Balance' in message:
        return PublicError('INSUFFICIENT_HSA_BALANCE', 409)
    if 'not accepting patients' in message:
        return PublicError('CLINIC_NOT_ACCEPTING', 409)
    if 'Clinic ID' in message and 'not found' in message:
        return PublicError('CLINIC_NOT_FOUND', 404)
    if 'not found' in message or code == '23503':
        return PublicError('NOT_FOUND', 404)
    if 'Invalid status change' in message:
        return PublicError('INVALID_STATUS_TRANSITION', 409)
    if 'Copay' in message or 'copay' in message:
        return PublicError('INVALID_COPAY')
    if code == '22003':  # numeric value out of range
        return PublicError('INVALID_COPAY')
    if code in ('57014', '55P03'):  # statement timeout
        return PublicError('DATABASE_TIMEOUT', 503)
    if code in ('42P01', '42883', '42703'):  # missing table, function or column
        return PublicError('DATABASE_SETUP_INCOMPLETE', 500)
    if code is None:  # connection-level failure: the server could not be reached
        return PublicError('POSTGRES_UNAVAILABLE', 503)
    return PublicError('DATABASE_ERROR', 500)


def translate_mongo(error):
    """Separate command/setup/auth failures from connectivity without exposing driver details."""
    from pymongo.errors import OperationFailure
    if isinstance(error, OperationFailure):
        code = error.code
        reason = str((error.details or {}).get('errmsg', '')).lower()
        if code == 13:
            return PublicError('MONGO_PERMISSION_DENIED', 503)
        if code == 18:
            return PublicError('MONGO_AUTH_FAILED', 503)
        if code in (27, 291, 16604, 17007) or (
            'geonear' in reason and ('index' in reason or 'namespace' in reason)
        ):
            return PublicError('MONGO_SETUP_INCOMPLETE', 503)
        if code in (168, 40324) or 'unrecognized expression' in reason or 'unrecognized pipeline stage' in reason:
            return PublicError('MONGO_VERSION_UNSUPPORTED', 503)
        return PublicError('MONGO_QUERY_FAILED', 500)
    return PublicError('MONGO_UNAVAILABLE', 503)
