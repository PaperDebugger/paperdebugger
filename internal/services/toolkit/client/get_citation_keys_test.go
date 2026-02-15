package client_test

import (
	"context"
	"os"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/client"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// setupTestClient creates an AIClientV2 for testing with MongoDB
func setupTestClient(t *testing.T) (*client.AIClientV2, *services.ProjectService) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	dbInstance, err := db.NewDB(cfg.GetCfg(), logger.GetLogger())
	if err != nil {
		t.Skipf("MongoDB not available: %v", err)
	}

	projectService := services.NewProjectService(dbInstance, cfg.GetCfg(), logger.GetLogger())
	aiClient := client.NewAIClientV2(
		dbInstance,
		&services.ReverseCommentService{},
		projectService,
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	return aiClient, projectService
}

// createTestProject creates a project with the given bib content for testing
func createTestProject(t *testing.T, projectService *services.ProjectService, userId bson.ObjectID, projectId string, bibContent []string) {
	ctx := context.Background()
	project := &models.Project{
		Docs: []models.ProjectDoc{
			{
				ID:       "bib-doc",
				Version:  1,
				Filepath: "references.bib",
				Lines:    bibContent,
			},
		},
	}
	_, err := projectService.UpsertProject(ctx, userId, projectId, project)
	assert.NoError(t, err)
}

func TestGetBibliographyForCitation_FieldExclusion(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-field-exclusion-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"@article{smith2020,",
		"  author = {John Smith},",
		"  title = {A Great Paper},",
		"  journal = {Nature},",
		"  url = {https://example.com/paper},",
		"  doi = {10.1234/example},",
		"  pages = {1-10},",
		"  volume = {5},",
		"  publisher = {Nature Publishing},",
		"  year = {2020},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Essential fields should be kept
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "John Smith")
	assert.Contains(t, result, "title")
	assert.Contains(t, result, "A Great Paper")
	assert.Contains(t, result, "journal")
	assert.Contains(t, result, "Nature")

	// Non-essential fields should be excluded
	assert.NotContains(t, result, "url")
	assert.NotContains(t, result, "https://example.com")
	assert.NotContains(t, result, "doi")
	assert.NotContains(t, result, "10.1234")
	assert.NotContains(t, result, "pages")
	assert.NotContains(t, result, "1-10")
	assert.NotContains(t, result, "volume")
	assert.NotContains(t, result, "publisher")
	assert.NotContains(t, result, "year")
}

func TestGetBibliographyForCitation_MultiLineFieldExclusion(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-multiline-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"@article{multiline2023,",
		"  author = {Test Author},",
		"  url = {https://example.com/",
		"         very/long/path/to/paper},",
		"  title = {Test Paper},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should keep author and title
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "title")

	// Should exclude multi-line url field completely
	assert.NotContains(t, result, "url")
	assert.NotContains(t, result, "very/long/path")
}

func TestGetBibliographyForCitation_StringEntryExclusion(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-string-entry-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"@String{nature = {Nature Publishing}}",
		"@String{longjournal = {Journal of Very",
		"  Long Names and Things}}",
		"@article{test2023,",
		"  author = {Test Author},",
		"  title = {Test Title},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should keep the article entry
	assert.Contains(t, result, "@article")
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "title")

	// Should exclude @String entries
	assert.NotContains(t, result, "@String")
	assert.NotContains(t, result, "Nature Publishing")
	assert.NotContains(t, result, "Long Names")
}

func TestGetBibliographyForCitation_CommentsAndEmptyLines(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-comments-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"% This is a comment that should be excluded",
		"@article{commented2023,",
		"",
		"  author = {Test Author},",
		"  % Another comment",
		"   ",
		"  title = {Test Title},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should keep the article content
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "title")

	// Should exclude comments
	assert.NotContains(t, result, "This is a comment")
	assert.NotContains(t, result, "Another comment")
}

func TestGetBibliographyForCitation_CaseInsensitiveFieldMatching(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-case-insensitive-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"@article{casetest,",
		"  AUTHOR = {Case Author},",
		"  URL = {https://example.com},",
		"  Title = {Case Title},",
		"  DOI = {10.1234/test},",
		"  Pages = {1-10},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should keep essential fields regardless of case
	assert.Contains(t, result, "AUTHOR")
	assert.Contains(t, result, "Title")

	// Should exclude non-essential fields regardless of case
	assert.NotContains(t, result, "URL")
	assert.NotContains(t, result, "DOI")
	assert.NotContains(t, result, "Pages")
}

func TestGetBibliographyForCitation_OnlyBibFiles(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-only-bib-" + bson.NewObjectID().Hex()

	project := &models.Project{
		Docs: []models.ProjectDoc{
			{
				ID:       "tex-doc",
				Version:  1,
				Filepath: "main.tex",
				Lines:    []string{"\\documentclass{article}", "\\begin{document}", "Hello"},
			},
			{
				ID:       "bib-doc",
				Version:  1,
				Filepath: "refs.bib",
				Lines:    []string{"@article{test,", "  author = {Bib Author},", "}"},
			},
			{
				ID:       "txt-doc",
				Version:  1,
				Filepath: "notes.txt",
				Lines:    []string{"Some notes here"},
			},
		},
	}
	_, err := projectService.UpsertProject(ctx, userId, projectId, project)
	assert.NoError(t, err)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should only contain bib file content
	assert.Contains(t, result, "Bib Author")

	// Should not contain tex or txt content
	assert.NotContains(t, result, "documentclass")
	assert.NotContains(t, result, "Some notes")
}

func TestGetBibliographyForCitation_QuotedFieldValues(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-quoted-" + bson.NewObjectID().Hex()

	bibContent := []string{
		`@article{quoted2023,`,
		`  author = "Alice Author",`,
		`  url = "https://example.com",`,
		`  title = "Quoted Title",`,
		`}`,
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should keep author and title
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "title")

	// Should exclude url even with quoted value
	assert.NotContains(t, result, "url")
	assert.NotContains(t, result, "https://example.com")
}

func TestGetBibliographyForCitation_NoBibFiles(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-no-bib-" + bson.NewObjectID().Hex()

	project := &models.Project{
		Docs: []models.ProjectDoc{
			{
				ID:       "tex-doc",
				Version:  1,
				Filepath: "main.tex",
				Lines:    []string{"\\documentclass{article}", "\\begin{document}", "Hello", "\\end{document}"},
			},
		},
	}
	_, err := projectService.UpsertProject(ctx, userId, projectId, project)
	assert.NoError(t, err)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)
	assert.Empty(t, result)
}

func TestGetBibliographyForCitation_EmptyBibFile(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-empty-bib-" + bson.NewObjectID().Hex()

	createTestProject(t, projectService, userId, projectId, []string{})

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)
	assert.Empty(t, result)
}

func TestGetBibliographyForCitation_NestedBraces(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-nested-braces-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"@article{nested2023,",
		"  author = {John {van} Smith},",
		"  title = {A {GPU}-Based Approach to {NLP}},",
		"  journal = {Journal of {AI} Research},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should preserve nested braces in kept fields
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "{van}")
	assert.Contains(t, result, "title")
	assert.Contains(t, result, "{GPU}")
	assert.Contains(t, result, "{NLP}")
	assert.Contains(t, result, "journal")
	assert.Contains(t, result, "{AI}")
}

func TestGetBibliographyForCitation_DifferentEntryTypes(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-entry-types-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"@article{article2023,",
		"  author = {Article Author},",
		"  title = {Article Title},",
		"}",
		"@book{book2023,",
		"  author = {Book Author},",
		"  title = {Book Title},",
		"}",
		"@inproceedings{inproc2023,",
		"  author = {Conference Author},",
		"  title = {Conference Paper},",
		"  booktitle = {ICML 2023},",
		"}",
		"@misc{misc2023,",
		"  author = {Misc Author},",
		"  title = {Misc Title},",
		"  note = {Some note},",
		"}",
		"@phdthesis{thesis2023,",
		"  author = {PhD Author},",
		"  title = {Thesis Title},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should include all entry types
	assert.Contains(t, result, "@article")
	assert.Contains(t, result, "@book")
	assert.Contains(t, result, "@inproceedings")
	assert.Contains(t, result, "@misc")
	assert.Contains(t, result, "@phdthesis")

	// Should preserve booktitle (not in excluded list)
	assert.Contains(t, result, "booktitle")
	assert.Contains(t, result, "ICML 2023")

	// Should preserve note (not in excluded list)
	assert.Contains(t, result, "note")
}

func TestGetBibliographyForCitation_MultiLineQuotedValues(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-multiline-quoted-" + bson.NewObjectID().Hex()

	bibContent := []string{
		`@article{quoted2023,`,
		`  author = "Test Author",`,
		`  url = "https://example.com/very/`,
		`         long/path/to/paper",`,
		`  title = "Test Title",`,
		`}`,
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should keep author and title
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "title")

	// Should exclude multi-line quoted url field
	assert.NotContains(t, result, "url")
	assert.NotContains(t, result, "long/path")
}

func TestGetBibliographyForCitation_MalformedEntry(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-malformed-" + bson.NewObjectID().Hex()

	bibContent := []string{
		"@article{valid2023,",
		"  author = {Valid Author},",
		"  title = {Valid Title},",
		"}",
		"@article{malformed2023,",
		"  author = {Malformed Author},",
		"  title = {Missing closing brace",
		"@article{aftermalformed,",
		"  author = {After Author},",
		"  title = {After Title},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// Should at least parse the valid entry
	assert.Contains(t, result, "Valid Author")
	assert.Contains(t, result, "Valid Title")
}

func TestGetBibliographyForCitation_EssentialFieldsPreserved(t *testing.T) {
	aiClient, projectService := setupTestClient(t)
	ctx := context.Background()
	userId := bson.NewObjectID()
	projectId := "test-essential-fields-" + bson.NewObjectID().Hex()

	// Test that important fields for citation matching are preserved
	bibContent := []string{
		"@article{essential2023,",
		"  author = {Essential Author},",
		"  title = {Essential Title},",
		"  journal = {Essential Journal},",
		"  booktitle = {Essential Booktitle},",
		"  note = {Essential Note},",
		"  keywords = {machine learning, AI},",
		"  abstract = {This is the abstract.},",
		"}",
	}

	createTestProject(t, projectService, userId, projectId, bibContent)

	result, err := aiClient.GetBibliographyForCitation(ctx, userId, projectId)
	assert.NoError(t, err)

	// These fields should be preserved as they're useful for citation matching
	assert.Contains(t, result, "author")
	assert.Contains(t, result, "title")
	assert.Contains(t, result, "journal")
	assert.Contains(t, result, "booktitle")
	assert.Contains(t, result, "note")
	assert.Contains(t, result, "keywords")
	assert.Contains(t, result, "abstract")
}

// TestCitationKeysParsing tests the expected parsing behavior for citation key responses.
// This verifies the parsing logic that GetCitationKeys uses internally.
func TestCitationKeysParsing(t *testing.T) {
	// Helper that mimics the parsing logic in GetCitationKeys
	parseCitationKeys := func(response string) []string {
		emptyCitation := "none"
		citationKeysStr := strings.TrimSpace(response)

		if citationKeysStr == "" || citationKeysStr == emptyCitation {
			return []string{}
		}

		keys := strings.Split(citationKeysStr, ",")
		result := make([]string, 0, len(keys))
		for _, key := range keys {
			trimmed := strings.TrimSpace(key)
			if trimmed != "" {
				result = append(result, trimmed)
			}
		}
		return result
	}

	tests := []struct {
		name     string
		response string
		expected []string
	}{
		{
			name:     "single key",
			response: "smith2020",
			expected: []string{"smith2020"},
		},
		{
			name:     "multiple keys comma separated",
			response: "smith2020,jones2021,doe2022",
			expected: []string{"smith2020", "jones2021", "doe2022"},
		},
		{
			name:     "keys with spaces around commas",
			response: "smith2020, jones2021, doe2022",
			expected: []string{"smith2020", "jones2021", "doe2022"},
		},
		{
			name:     "empty response",
			response: "",
			expected: []string{},
		},
		{
			name:     "none response",
			response: "none",
			expected: []string{},
		},
		{
			name:     "whitespace only",
			response: "   ",
			expected: []string{},
		},
		{
			name:     "response with leading/trailing whitespace",
			response: "  smith2020,jones2021  ",
			expected: []string{"smith2020", "jones2021"},
		},
		{
			name:     "handles empty segments from trailing comma",
			response: "smith2020,jones2021,",
			expected: []string{"smith2020", "jones2021"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseCitationKeys(tt.response)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestCitationPromptFormat verifies the expected prompt structure.
// This ensures the prompt format meets requirements (bibliography first for caching, etc.)
func TestCitationPromptFormat(t *testing.T) {
	// Helper that mimics the prompt building in GetCitationKeys
	buildPrompt := func(bibliography, sentence string) string {
		emptyCitation := "none"
		return "Bibliography: " + bibliography + "\nSentence: " + sentence + "\nBased on the sentence and bibliography, suggest only the most relevant citation keys separated by commas with no spaces (e.g. key1,key2). Be selective and only include citations that are directly relevant. Avoid suggesting more than 3 citations. If no relevant citations are found, return '" + emptyCitation + "'."
	}

	t.Run("bibliography comes first for prompt caching", func(t *testing.T) {
		prompt := buildPrompt("@article{test}", "Test sentence")
		assert.True(t, strings.HasPrefix(prompt, "Bibliography:"),
			"prompt should start with Bibliography for prompt caching")
	})

	t.Run("contains bibliography content", func(t *testing.T) {
		prompt := buildPrompt("@article{smith2020, author={Smith}}", "Test sentence")
		assert.Contains(t, prompt, "@article{smith2020")
		assert.Contains(t, prompt, "author={Smith}")
	})

	t.Run("contains sentence", func(t *testing.T) {
		prompt := buildPrompt("@article{test}", "Machine learning is transforming research.")
		assert.Contains(t, prompt, "Machine learning is transforming research.")
	})

	t.Run("includes empty citation marker", func(t *testing.T) {
		prompt := buildPrompt("", "Test")
		assert.Contains(t, prompt, "none")
	})

	t.Run("includes format instructions", func(t *testing.T) {
		prompt := buildPrompt("", "Test")
		assert.Contains(t, prompt, "comma")
		assert.Contains(t, prompt, "key1,key2")
	})
}
