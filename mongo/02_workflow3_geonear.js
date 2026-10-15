// Database name: CARECONNECT_MONGO_DB if set, otherwise "medical_db".
if (process.env.CARECONNECT_MONGO_DB && process.env.CARECONNECT_MONGO_DB !== 'medical_db')
  throw new Error('Set CARECONNECT_MONGO_DB=medical_db.');
db = db.getSiblingDB('medical_db');

// Workflow 3: nearest active mobile nurses within 5 km of a point.
// The parameters are overridable from the environment so an API can reuse the same pipeline.
// PARAMS-BEGIN
const ORIGIN_LNG = Number(process.env.CARECONNECT_LNG || 78.346144);
const ORIGIN_LAT = Number(process.env.CARECONNECT_LAT || 17.445376);
const MAX_DISTANCE_M = Number(process.env.CARECONNECT_RADIUS_M || 5000);   // metres (2dsphere)
const RESULT_LIMIT = Number(process.env.CARECONNECT_LIMIT || 10);
// PARAMS-END

const result = db.NursePings.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [ORIGIN_LNG, ORIGIN_LAT] },
      key: "location",
      distanceField: "dist.calculated",
      maxDistance: MAX_DISTANCE_M,
      query: { is_active: true },
      spherical: true
    }
  },
  // A nurse sends many pings: keep only the nearest ping per nurse ($geoNear output is nearest-first).
  { $group: { _id: "$nurse_id", nearest: { $first: "$$ROOT" } } },
  { $replaceRoot: { newRoot: "$nearest" } },
  { $sort: { "dist.calculated": 1 } },
  { $limit: RESULT_LIMIT }
]).toArray();

printjson(result);
