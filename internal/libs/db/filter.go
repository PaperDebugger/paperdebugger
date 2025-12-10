package db

import "go.mongodb.org/mongo-driver/v2/bson"

// NotDeleted returns a filter condition for soft-deleted records.
// Use this to exclude records that have been soft-deleted.
func NotDeleted() bson.M {
	return bson.M{
		"$or": []bson.M{
			{"deleted_at": nil},
			{"deleted_at": bson.M{"$exists": false}},
		},
	}
}

// WithNotDeleted merges the soft-delete filter with an existing filter.
func WithNotDeleted(filter bson.M) bson.M {
	for k, v := range NotDeleted() {
		filter[k] = v
	}
	return filter
}
