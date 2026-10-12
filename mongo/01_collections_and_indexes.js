// Database name: CARECONNECT_MONGO_DB if set, otherwise "careconnect" (same variable as mongo_seeder.py).
db = db.getSiblingDB(process.env.CARECONNECT_MONGO_DB || "careconnect");

// 2dsphere index on NursePings location
db.NursePings.createIndex({ location: "2dsphere" });

// 2-hour TTL index on created_at
db.NursePings.createIndex({ created_at: 1 }, { expireAfterSeconds: 7200 });

// Reviews: rating index (used by the rating-distribution facet and rating filters)
db.PatientReviews.createIndex({ rating: 1 });

// Medical catalogue: look-ups by specialty
db.MedicalCatalogs.createIndex({ specialty: 1 });
