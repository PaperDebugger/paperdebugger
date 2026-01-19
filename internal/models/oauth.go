package models

import "go.mongodb.org/mongo-driver/v2/bson"

type OAuth struct {
	BaseModel   `bson:",inline"`
	Code        string        `bson:"code,omitempty"` // OAuth code (authorization code) in Google's implementation is single-use, short-lived, and temporarily unique.
	AccessToken string        `bson:"access_token,omitempty"`
	State       string        `bson:"state,omitempty"`
	Used        bool          `bson:"used,omitempty"`
	UsedAt      bson.DateTime `bson:"used_at,omitempty"` // Timestamp when the record was first marked as used, allows 10s reuse window
}

func (o OAuth) CollectionName() string {
	return "oauth"
}
