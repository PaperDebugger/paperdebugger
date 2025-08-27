package stringutil

import "math"

// LevenshteinDistance calculates the Levenshtein distance between two strings.
func LevenshteinDistance(s1, s2 string) int {
	if len(s1) == 0 {
		return len(s2)
	}
	if len(s2) == 0 {
		return len(s1)
	}

	// Create a matrix to store distances
	matrix := make([][]int, len(s1)+1)
	for i := range matrix {
		matrix[i] = make([]int, len(s2)+1)
		matrix[i][0] = i
	}
	for j := range matrix[0] {
		matrix[0][j] = j
	}

	// Fill the matrix
	for i := 1; i <= len(s1); i++ {
		for j := 1; j <= len(s2); j++ {
			if s1[i-1] == s2[j-1] {
				matrix[i][j] = matrix[i-1][j-1]
			} else {
				matrix[i][j] = int(math.Min(
					math.Min(
						float64(matrix[i-1][j]+1), // deletion
						float64(matrix[i][j-1]+1), // insertion
					),
					float64(matrix[i-1][j-1]+1), // substitution
				))
			}
		}
	}

	return matrix[len(s1)][len(s2)]
}

// Similarity returns a normalized similarity score between 0 and 1 based on Levenshtein distance.
func Similarity(a, b string) float64 {
	distance := LevenshteinDistance(a, b)
	if len(a) == 0 && len(b) == 0 {
		return 1.0
	}
	return 1.0 - float64(distance)/math.Max(float64(len(a)), float64(len(b)))
}
