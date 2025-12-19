package db

import "go.mongodb.org/mongo-driver/v2/bson"

// NotDeleted returns a filter that excludes soft-deleted documents.
// Use with MergeFilters to combine with other query conditions.
func NotDeleted() bson.M {
	return bson.M{
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}
}

// MergeFilters combines multiple filters with $and.
// If only one filter is provided, it returns that filter directly.
func MergeFilters(filters ...bson.M) bson.M {
	if len(filters) == 0 {
		return bson.M{}
	}
	if len(filters) == 1 {
		return filters[0]
	}
	return bson.M{"$and": filters}
}
