// Database name: CARECONNECT_MONGO_DB if set, otherwise "careconnect_a2".
if (process.env.CARECONNECT_MONGO_DB && process.env.CARECONNECT_MONGO_DB !== 'careconnect_a2')
  throw new Error('Set CARECONNECT_MONGO_DB=careconnect_a2.');
db = db.getSiblingDB('careconnect_a2');

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
