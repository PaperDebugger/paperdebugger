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

func TestRemoveCommentsBackslashRunsBeforePercent(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"1 backslash (odd) preserves %", `a\% keep`, `a\% keep`},
		{"2 backslashes (even) strips comment", `a\\% drop`, `a\\`},
		{"3 backslashes (odd) preserves %", `a\\\% keep`, `a\\\% keep`},
		{"4 backslashes (even) strips comment", `a\\\\% drop`, `a\\\\`},
		{"5 backslashes (odd) preserves %", `a\\\\\% keep`, `a\\\\\% keep`},
		{"3 backslashes at line start preserves %", `\\\% keep`, `\\\% keep`},
		{"4 backslashes at line start strips comment", `\\\\% drop`, `\\\\`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, removeComments(tc.input))
		})
	}
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
