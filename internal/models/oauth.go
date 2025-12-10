package models

type OAuth struct {
	BaseModel   `bson:",inline"`
	Code        string `bson:"code,omitempty"` // OAuth authorization code - single-use and short-lived (temporary and unique in Google's implementation)
	AccessToken string `bson:"access_token,omitempty"`
	State       string `bson:"state,omitempty"`
	Used        bool   `bson:"used,omitempty"`
}

func (o OAuth) CollectionName() string {
	return "oauth"
}
