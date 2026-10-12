// Database name: CARECONNECT_MONGO_DB if set, otherwise "careconnect" (same variable as mongo_seeder.py).
db = db.getSiblingDB(process.env.CARECONNECT_MONGO_DB || "careconnect");

// Validators: reject bad documents at insert/update time (existing documents are not re-checked).
// Plain numbers typed in mongosh/Node are stored as double, so whole-number doubles are accepted.
function ensureValidator(name, schema) {
  const opts = { validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error" };
  if (db.getCollectionNames().includes(name)) db.runCommand(Object.assign({ collMod: name }, opts));
  else db.createCollection(name, opts);
}
const num = ["int", "long", "double"];

ensureValidator("NursePings", {
  bsonType: "object",
  required: ["nurse_id", "is_active", "location", "created_at"],
  properties: {
    nurse_id:   { bsonType: num, multipleOf: 1 },
    is_active:  { bsonType: "bool" },
    location:   { bsonType: "object", required: ["type", "coordinates"],
                  properties: { type: { enum: ["Point"] },
                                coordinates: { bsonType: "array", minItems: 2, maxItems: 2, items: { bsonType: num } } } },
    created_at: { bsonType: "date" }          // TTL only works on real dates
  }
});

ensureValidator("PatientReviews", {
  bsonType: "object",
  required: ["rating"],
  properties: {
    rating: { bsonType: num, minimum: 1, maximum: 5, multipleOf: 1 },
    bedside_manner_tags: { bsonType: "array", items: { bsonType: "string" } }
  }
});

// 2dsphere index on NursePings location
db.NursePings.createIndex({ location: "2dsphere" });

// 2-hour TTL index on created_at
db.NursePings.createIndex({ created_at: 1 }, { expireAfterSeconds: 7200 });

// Reviews: rating index (used by the rating-distribution facet and rating filters)
db.PatientReviews.createIndex({ rating: 1 });

// Medical catalogue: look-ups by specialty
db.MedicalCatalogs.createIndex({ specialty: 1 });
