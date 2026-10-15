"""Idempotent supporting indexes for both manual and Docker bootstrap."""


def ensure_mongo_indexes(db):
    # Keep the same generated names/options as mongo/01 and mongo/04. Existing
    # collections and their documents are preserved; no destructive reset occurs.
    db.NursePings.create_index([('location', '2dsphere')])
    db.NursePings.create_index([('created_at', 1)], expireAfterSeconds=7200)
    db.NursePings.create_index([('nurse_id', 1), ('created_at', -1), ('_id', -1)])
    db.PatientReviews.create_index([('rating', 1)])
    db.MedicalCatalogs.create_index([('specialty', 1)])
    db.Nurses.create_index([('nurse_id', 1)], unique=True)
