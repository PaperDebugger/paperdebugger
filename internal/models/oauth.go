package models

type OAuth struct {
	BaseModel   `bson:",inline"`
	Code        string `bson:"code,omitempty"` // OAuth code (authorization code) in Google's implementation is single-use, short-lived, and temporarily unique.
	AccessToken string `bson:"access_token,omitempty"`
	State       string `bson:"state,omitempty"`
	Used        bool   `bson:"used,omitempty"`
}

func (o OAuth) CollectionName() string {
	return "oauth"
}
