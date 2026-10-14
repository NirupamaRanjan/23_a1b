import json
import re
from datetime import datetime, timedelta, timezone
from .database import transport
from .errors import PublicError
from .services import page_result


def nearby_pipeline(latitude, longitude, limit, now):
    return [
        {'$geoNear': {'near': {'type':'Point','coordinates':[longitude,latitude]},
            'distanceField':'dist.calculated','maxDistance':5000,'spherical':True,
            'query':{'is_active':True,'created_at':{'$gte':now-timedelta(hours=2),'$lte':now}}}},
        # Keep the latest nearby candidate, then verify it is also the latest ping overall.
        {'$group': {'_id':'$nurse_id','candidate':{'$top':{
            'sortBy':{'created_at':-1,'_id':-1},'output':'$$ROOT'}}}},
        {'$lookup': {'from':'NursePings','localField':'_id','foreignField':'nurse_id',
            'pipeline':[{'$sort':{'created_at':-1,'_id':-1}},{'$limit':1},{'$project':{'_id':1}}],
            'as':'latest'}},
        {'$match': {'$expr':{'$eq':['$candidate._id',{'$arrayElemAt':['$latest._id',0]}]}}},
        {'$replaceRoot':{'newRoot':'$candidate'}},
        {'$sort':{'dist.calculated':1,'nurse_id':1}},
        {'$limit':limit},
        {'$project':{'_id':0}},
    ]

REVIEW_PIPELINE = [{'$facet': {
    'rating_distribution':[{'$group':{'_id':'$rating','count':{'$sum':1}}},{'$sort':{'_id':1}}],
    'frequent_tags':[{'$unwind':'$bedside_manner_tags'},{'$group':{'_id':'$bedside_manner_tags','count':{'$sum':1}}},
        {'$sort':{'count':-1,'_id':1}},{'$limit':10}],
    'overall_summary':[{'$group':{'_id':None,'avg_rating':{'$avg':'$rating'},'total_reviews':{'$sum':1}}}]
}}]

class MongoService:
    def __init__(self, database):
        self.db = database.mongo

    def nearby(self, latitude, longitude, limit):
        now = datetime.now(timezone.utc)
        rows = list(self.db.NursePings.aggregate(nearby_pipeline(latitude,longitude,limit,now),
            allowDiskUse=True,maxTimeMS=12000))
        return transport({'updated_at':now,'items':rows})

    def reviews(self):
        facets = next(self.db.PatientReviews.aggregate(REVIEW_PIPELINE,maxTimeMS=12000))
        summary = facets['overall_summary'][0] if facets['overall_summary'] else {'avg_rating':None,'total_reviews':0}
        buckets = {int(row['_id']):row['count'] for row in facets['rating_distribution']}
        return {'total_reviews':summary['total_reviews'],'avg_rating':summary['avg_rating'],
            'rating_distribution':[{'rating':rating,'count':buckets.get(rating,0)} for rating in range(1,6)],
            'frequent_tags':[{'tag':row['_id'],'count':row['count']} for row in facets['frequent_tags']]}

    def catalogs(self, q, page, size):
        query = {'specialty':{'$regex':re.escape(q),'$options':'i'}} if q else {}
        total = self.db.MedicalCatalogs.count_documents(query,maxTimeMS=10000)
        rows = list(self.db.MedicalCatalogs.find(query).sort('_id',1).skip((page-1)*size).limit(size).max_time_ms(10000))
        items = []
        for row in rows:
            row['id'] = str(row.pop('_id'))
            item = transport(row)
            if len(json.dumps(item).encode()) > 262144:
                raise PublicError('DOCUMENT_TOO_LARGE',413)
            items.append(item)
        return page_result(items,total,page,size)
