// Database name: CARECONNECT_MONGO_DB if set, otherwise "medical_db".
if (process.env.CARECONNECT_MONGO_DB && process.env.CARECONNECT_MONGO_DB !== 'medical_db')
  throw new Error('Set CARECONNECT_MONGO_DB=medical_db.');
db = db.getSiblingDB('medical_db');

// Workflow 4: Multi-Faceted Review Analytics
const facetResults = db.PatientReviews.aggregate([
  {
    $facet: {
      "rating_distribution": [
        { $group: { _id: "$rating", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ],
      "frequent_tags": [
        { $unwind: "$bedside_manner_tags" },
        { $group: { _id: "$bedside_manner_tags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ],
      "overall_summary": [
        {
          $group: {
            _id: null,
            avg_rating: { $avg: "$rating" },
            total_reviews: { $sum: 1 }
          }
        }
      ]
    }
  }
]).toArray();

printjson(facetResults);
