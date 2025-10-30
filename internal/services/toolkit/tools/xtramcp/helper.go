package xtramcp

import (
	"fmt"
	"strings"
)

// extracts JSON data from SSE format response
// SSE format:
//
//	event: message
//	data: { ... }
func parseSSEResponse(body []byte) (string, error) {
	lines := strings.Split(string(body), "\n")

	for _, line := range lines {
		if strings.HasPrefix(line, "data: ") {
			jsonData := strings.TrimPrefix(line, "data: ")
			return jsonData, nil
		}
	}

	return "", fmt.Errorf("no data line found in SSE response")
}
