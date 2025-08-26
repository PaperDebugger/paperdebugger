package webapp

import (
	"io/fs"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetWebappFS(t *testing.T) {
	webappFS := GetWebappFS()
	assert.NotNil(t, webappFS)

	files, err := fs.ReadDir(webappFS, ".")
	assert.NoError(t, err)
	assert.NotNil(t, files)
}
