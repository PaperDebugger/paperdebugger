package services

import (
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/libs/stringutil"
	"paperdebugger/internal/models"
	projectv1 "paperdebugger/pkg/gen/api/project/v1"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type ReverseCommentService struct {
	BaseService
	commentCollection *mongo.Collection
	projectService    *ProjectService
}

type CommentResponse struct {
	TargetSectionName string                 `json:"target_section_name"`
	AnchorText        string                 `json:"anchor_text"`
	CommentText       string                 `json:"comment_text"`
	ImportanceLevel   models.ImportanceLevel `json:"importance_level"`
}

// UnmarshalJSON implements custom JSON unmarshaling for CommentResponse
func (c *CommentResponse) UnmarshalJSON(data []byte) error {
	type Alias CommentResponse
	aux := &struct {
		ImportanceLevel string `json:"importance_level"`
		*Alias
	}{
		Alias: (*Alias)(c),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	c.ImportanceLevel = models.ImportanceLevel(aux.ImportanceLevel)
	return nil
}

const (
	NoMatchPosition = -1
)

func NewReverseCommentService(db *db.DB, cfg *cfg.Cfg, logger *logger.Logger, projectService *ProjectService) *ReverseCommentService {
	base := NewBaseService(db, cfg, logger)
	return &ReverseCommentService{
		BaseService:       base,
		commentCollection: base.db.Collection((models.Comment{}).CollectionName()),
		projectService:    projectService,
	}
}

// isSectionHeader checks if a line is a valid LaTeX section header
func isSectionHeader(line string) bool {
	// Skip comment lines
	if strings.HasPrefix(strings.TrimSpace(line), "%") {
		return false
	}

	// Check for section commands
	sectionTypes := []string{"\\section{", "\\subsection{", "\\subsubsection{"}
	for _, sectionType := range sectionTypes {
		if strings.Contains(line, sectionType) {
			return true
		}
	}
	return false
}

// generateDocSHA1 generates a SHA1 hash for the document content
func generateDocSHA1(content string) string {
	h := sha1.New()
	h.Write([]byte(fmt.Sprintf("blob %d\x00%s", utf8.RuneCountInString(content), content)))
	return fmt.Sprintf("%x", h.Sum(nil))
}

// findBestMatchPosition finds the position in the document that best matches the anchor text
// using Levenshtein distance with a similarity threshold
func (s *ReverseCommentService) findBestMatchPosition(docContent, anchorText string) (int, string) {
	if anchorText == "" {
		return NoMatchPosition, ""
	}

	if len(anchorText) > len(docContent) {
		return NoMatchPosition, ""
	}

	// Try exact match first
	if pos, match := exactMatchPosition(docContent, anchorText); pos != NoMatchPosition {
		return pos, match
	}

	// Fallback to fuzzy match
	return s.fuzzyMatchPosition(docContent, anchorText)
}

// exactMatchPosition returns the rune position and text if anchorText is found exactly in docContent
func exactMatchPosition(docContent, anchorText string) (int, string) {
	if strings.Contains(docContent, anchorText) {
		position := strings.Index(docContent, anchorText)
		actualPosition := utf8.RuneCountInString(docContent[:position])
		return actualPosition, anchorText
	}
	return NoMatchPosition, ""
}

// fuzzyMatchPosition uses Levenshtein similarity to find the best window in docContent
func (s *ReverseCommentService) fuzzyMatchPosition(docContent, anchorText string) (int, string) {
	windowSize := len(anchorText)
	chunkSize := 1000 // Number of windows each goroutine will process
	numChunks := (len(docContent) - windowSize) / chunkSize
	if numChunks == 0 {
		numChunks = 1
	}

	type matchResult struct {
		position    int
		similarity  float64
		matchedText string
	}

	resultChan := make(chan matchResult, numChunks)
	var wg sync.WaitGroup

	for i := 0; i < numChunks; i++ {
		wg.Add(1)
		go func(chunkIndex int) {
			defer wg.Done()
			start := chunkIndex * chunkSize
			end := start + chunkSize
			if end > len(docContent)-windowSize {
				end = len(docContent) - windowSize
			}

			bestResult := matchResult{position: -1, similarity: 0}

			defer func() {
				if r := recover(); r != nil {
					s.logger.Error("panic recovered in fuzzyMatchPosition goroutine",
						"error", r,
						"chunk_index", chunkIndex,
						"start", start,
						"end", end)
					resultChan <- matchResult{position: -1, similarity: 0}
				}
			}()

			for j := start; j < end; j++ {
				window := docContent[j : j+windowSize]
				similarity := stringutil.Similarity(window, anchorText)

				if similarity > bestResult.similarity {
					bestResult = matchResult{
						position:    j,
						similarity:  similarity,
						matchedText: window,
					}
				}
			}

			resultChan <- bestResult
		}(i)
	}

	go func() {
		wg.Wait()
		close(resultChan)
	}()

	bestPosition := -1
	bestSimilarity := 0.0
	bestMatchedText := ""

	for result := range resultChan {
		if result.similarity > bestSimilarity {
			bestSimilarity = result.similarity
			bestPosition = result.position
			bestMatchedText = result.matchedText
		}
	}

	if bestSimilarity < 0.65 {
		return -1, ""
	}

	actualPosition := utf8.RuneCountInString(docContent[:bestPosition])
	return actualPosition, bestMatchedText
}

// findTargetDocBySection searches for a document containing the target section name
// It handles both direct section definitions and sections with input statements
func (s *ReverseCommentService) findTargetDocBySection(project *models.Project, targetSectionName string) *models.ProjectDoc {
	// First pass: look for direct section matches
	for _, doc := range project.Docs {
		for i, line := range doc.Lines {
			if isSectionHeader(line) && strings.Contains(
				strings.ToLower(line),
				strings.ToLower(targetSectionName),
			) {
				// Check if this section is followed by an input statement
				if i+1 < len(doc.Lines) {
					nextLine := strings.TrimSpace(doc.Lines[i+1])
					if strings.HasPrefix(nextLine, "\\input{") {
						// Extract the input file name
						inputFile := strings.TrimPrefix(nextLine, "\\input{")
						inputFile = strings.TrimSuffix(inputFile, "}")

						// Look for the input file in project docs
						for _, inputDoc := range project.Docs {
							if strings.HasSuffix(inputDoc.Filepath, inputFile+".tex") {
								return &inputDoc
							}
						}
					}
				}
				// If no input statement or input file not found, return current doc
				return &doc
			}
		}
	}

	// Second pass: look for input statements that might contain the section
	for _, doc := range project.Docs {
		for _, line := range doc.Lines {
			if strings.HasPrefix(strings.TrimSpace(line), "\\input{") {
				inputFile := strings.TrimPrefix(strings.TrimSpace(line), "\\input{")
				inputFile = strings.TrimSuffix(inputFile, "}")

				// Look for the input file in project docs
				for _, inputDoc := range project.Docs {
					if strings.HasSuffix(inputDoc.Filepath, inputFile+".tex") {
						// Check if this input file contains the target section
						for _, inputLine := range inputDoc.Lines {
							if isSectionHeader(inputLine) && strings.Contains(
								strings.ToLower(inputLine),
								strings.ToLower(targetSectionName),
							) {
								return &inputDoc
							}
						}
					}
				}
			}
		}
	}

	return nil
}

// ReverseComments add comments to the project
// `project_id` is the _id of the project (not the overleaf project id)
func (s *ReverseCommentService) ReverseComments(ctx context.Context, comments *projectv1.PaperScoreCommentResult) ([]*projectv1.OverleafComment, error) {
	actor, err := contextutil.GetActor(ctx)
	if err != nil {
		s.logger.Error("failed to get actor", err)
		return nil, err
	}

	projectId, err := contextutil.GetProjectID(ctx)
	if err != nil {
		s.logger.Error("failed to get project id", err)
		return nil, err
	}

	// Get the project from the database
	project, err := s.projectService.GetProject(ctx, actor.ID, projectId)
	if err != nil {
		s.logger.Error("failed to get project", err)
		return nil, err
	}

	requests := []*projectv1.OverleafComment{}

	for _, comment := range comments.Results {
		// Find the target document using the new function
		targetDoc := s.findTargetDocBySection(project, comment.Section)
		if targetDoc == nil {
			s.logger.Info("target doc not found", "comment", comment)
			continue
		}

		comment.AnchorText = strings.TrimSpace(comment.AnchorText)
		comment.Weakness = fmt.Sprintf(`👨🏻‍💻 %s: %s`, comment.Importance, comment.Weakness)

		// Generate SHA1 hash for the document content
		docContent := strings.Join(targetDoc.Lines, "\n")
		docSHA1 := generateDocSHA1(docContent)
		quotePosition, matchedText := s.findBestMatchPosition(docContent, comment.AnchorText)
		if quotePosition == -1 {
			s.logger.Info("No sufficiently similar match found for comment", "comment", comment)
			continue
		}

		commentRecord := s.createCommentRecord(actor.ID, projectId, targetDoc, docSHA1, quotePosition, matchedText, comment)
		one, err := s.commentCollection.InsertOne(ctx, commentRecord)
		if err != nil {
			return nil, err
		}

		overleafComment := toOverleafComment(one.InsertedID.(bson.ObjectID), projectId, targetDoc, docSHA1, quotePosition, matchedText, comment)
		requests = append(requests, overleafComment)
	}

	return requests, nil
}

// createCommentRecord creates a models.Comment from the provided data
func (s *ReverseCommentService) createCommentRecord(userID bson.ObjectID, projectId string, targetDoc *models.ProjectDoc, docSHA1 string, quotePosition int, matchedText string, comment *projectv1.PaperScoreCommentEntry) *models.Comment {
	return &models.Comment{
		BaseModel: models.BaseModel{
			ID:        bson.NewObjectID(),
			CreatedAt: bson.NewDateTimeFromTime(time.Now()),
			UpdatedAt: bson.NewDateTimeFromTime(time.Now()),
		},
		UserID:            userID,
		ProjectID:         projectId,
		DocID:             targetDoc.ID,
		DocVersion:        targetDoc.Version,
		DocSHA1:           docSHA1,
		QuotePosition:     quotePosition,
		QuoteText:         matchedText,
		Comment:           comment.Weakness,
		ImportanceLevel:   models.ImportanceLevel(comment.Importance),
		IsAddedToOverleaf: models.CommentStatusNoAction,
		DocPath:           targetDoc.Filepath,
		Section:           comment.Section,
	}
}

// toOverleafComment converts the data to a projectv1.OverleafComment
func toOverleafComment(insertedID bson.ObjectID, projectId string, targetDoc *models.ProjectDoc, docSHA1 string, quotePosition int, matchedText string, comment *projectv1.PaperScoreCommentEntry) *projectv1.OverleafComment {
	return &projectv1.OverleafComment{
		CommentId:     insertedID.Hex(),
		ProjectId:     projectId,
		DocId:         targetDoc.ID,
		DocVersion:    int32(targetDoc.Version),
		DocSha1:       docSHA1,
		QuotePosition: int32(quotePosition),
		QuoteText:     matchedText,
		Comment:       comment.Weakness,
		Importance:    string(comment.Importance),
		DocPath:       targetDoc.Filepath,
		Section:       comment.Section,
	}
}

func (s *ReverseCommentService) CommentCollection() *mongo.Collection {
	return s.commentCollection
}

func (s *ReverseCommentService) GetComment(ctx context.Context, userID bson.ObjectID, projectID string, commentID bson.ObjectID) (*models.Comment, error) {
	comment := &models.Comment{}
	err := s.commentCollection.FindOne(ctx, bson.M{
		"_id":        commentID,
		"user_id":    userID,
		"project_id": projectID,
	}).Decode(comment)
	if err != nil {
		return nil, err
	}
	return comment, nil
}

func (s *ReverseCommentService) UpdateComment(ctx context.Context, userID bson.ObjectID, projectID string, commentID bson.ObjectID, comment *models.Comment) error {
	_, err := s.commentCollection.UpdateOne(ctx, bson.M{
		"_id":        commentID,
		"user_id":    userID,
		"project_id": projectID,
	}, bson.M{"$set": comment})
	return err
}
