db = db.getSiblingDB(process.env.CARECONNECT_MONGO_DB || 'careconnect');
// Speeds up the latest ping check; the 2dsphere index still drives $geoNear.
db.NursePings.createIndex({ nurse_id: 1, created_at: -1, _id: -1 });
