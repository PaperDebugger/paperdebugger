package xtramcp

import "encoding/json"

// parameters that should be injected server-side
var securityParameters = []string{"user_id", "project_id"}

// removes security parameters from schema shown to LLM so LLM does not need to generate / fill
func filterSecurityParameters(schema map[string]interface{}) map[string]interface{} {
	filtered := deepCopySchema(schema)

	// Remove from properties
	if properties, ok := filtered["properties"].(map[string]interface{}); ok {
		for _, param := range securityParameters {
			delete(properties, param)
		}
	}

	// Remove from required array
	if required, ok := filtered["required"].([]interface{}); ok {
		filtered["required"] = filterRequiredArray(required, securityParameters)
	}

	return filtered
}

// creates a deep copy of the schema using JSON marshal/unmarshal
// Uses JSON round-trip because map[string]interface{} contains nested structures
// This ensures modifications to the copy don't affect the original schema.
func deepCopySchema(schema map[string]interface{}) map[string]interface{} {
	// Use JSON marshal/unmarshal for deep copy
	jsonBytes, err := json.Marshal(schema)
	if err != nil {
		// Extremely unlikely with valid JSON schemas (MCP schemas are JSON-compatible)
		// If marshaling fails, return original schema
		return schema
	}

	var copy map[string]interface{}
	err = json.Unmarshal(jsonBytes, &copy)
	if err != nil {
		// Should never happen if marshal succeeded
		return schema
	}

	return copy
}

// removes security parameters from the required array
func filterRequiredArray(required []interface{}, toRemove []string) []interface{} {
	filtered := []interface{}{}
	removeMap := make(map[string]bool)

	for _, r := range toRemove {
		removeMap[r] = true
	}

	// filter out security params
	for _, item := range required {
		if str, ok := item.(string); ok {
			if !removeMap[str] {
				filtered = append(filtered, item)
			}
		}
	}

	return filtered
}
