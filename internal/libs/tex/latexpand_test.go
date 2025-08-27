package tex

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRemoveComments(t *testing.T) {
	const input = `
		% This is a comment
		\documentclass{article} % This is a comment
		\begin{document}
		Hello, world!
		\end{document}
	`
	assert.Equal(t, `\documentclass{article}
\begin{document}
Hello, world!
\end{document}`, removeComments(input))
}

func TestLatexpand(t *testing.T) {
	input := map[string]string{
		"main.tex": `
		\documentclass{article}
		\begin{document}
		\input{include.tex}
		\end{document}`,
		"include.tex": `
		Hello World!`,
	}
	expanded, err := Latexpand(input, "main.tex")
	assert.NoError(t, err)
	assert.Equal(t, `\documentclass{article}
\begin{document}
Hello World!
\end{document}`, expanded)
}
