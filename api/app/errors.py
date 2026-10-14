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
    if code == '57014':  # statement timeout
        return PublicError('DATABASE_TIMEOUT', 503)
    if code in ('42P01', '42883', '42703'):  # missing table, function or column
        return PublicError('DATABASE_SETUP_INCOMPLETE', 500)
    if code is None:  # connection-level failure: the server could not be reached
        return PublicError('POSTGRES_UNAVAILABLE', 503)
    return PublicError('DATABASE_ERROR', 500)
