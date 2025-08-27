package models

type OAuth struct {
	BaseModel   `bson:",inline"`
	Code        string `bson:"code,omitempty"` // OAuth 中的 code（即 authorization code）在 Google 的实现下 是一次性使用且短时间内有效的、临时唯一的。
	AccessToken string `bson:"access_token,omitempty"`
	State       string `bson:"state,omitempty"`
	Used        bool   `bson:"used,omitempty"`
}

func (o OAuth) CollectionName() string {
	return "oauth"
}
