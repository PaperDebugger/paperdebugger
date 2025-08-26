package webapp

import (
	"embed"
	"io/fs"
)

//go:embed _webapp/dist
var embedWebappFS embed.FS

func GetWebappFS() fs.FS {
	webappFS, _ := fs.Sub(embedWebappFS, "_webapp/dist")
	return webappFS
}
