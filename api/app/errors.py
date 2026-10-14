class PublicError(Exception):
    def __init__(self, code, status=400):
        self.code = code
        self.status = status


def translate_postgres(error):
    """Database messages are inspected internally and never returned to clients."""
    message = str(error)
    if error.pgcode == '23505' and getattr(error.diag, 'constraint_name', '') == 'idx_active_consult':
        return PublicError('ACTIVE_VISIT_EXISTS', 409)
    if 'Insufficient HSA Balance' in message:
        return PublicError('INSUFFICIENT_HSA_BALANCE', 409)
    if 'not accepting patients' in message:
        return PublicError('CLINIC_NOT_ACCEPTING', 409)
    if 'not found' in message or error.pgcode == '23503':
        return PublicError('NOT_FOUND', 404)
    if 'Invalid status change' in message:
        return PublicError('INVALID_STATUS_TRANSITION', 409)
    if 'Copay' in message:
        return PublicError('INVALID_COPAY')
    return PublicError('DATABASE_UNAVAILABLE', 503)
