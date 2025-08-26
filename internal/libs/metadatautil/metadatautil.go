package metadatautil

import "google.golang.org/grpc/metadata"

const (
	MetadataKeyAuthToken = "x-auth-token"
)

func SetAuthToken(md metadata.MD, token string) {
	md.Set(MetadataKeyAuthToken, token)
}

func GetAuthToken(md metadata.MD) string {
	chunks := md.Get(MetadataKeyAuthToken)
	if len(chunks) == 0 {
		return ""
	}
	return chunks[0]
}
