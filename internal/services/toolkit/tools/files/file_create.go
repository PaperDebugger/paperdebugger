package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"paperdebugger/internal/libs/contextutil"
	"paperdebugger/internal/libs/overleaf"
	"paperdebugger/internal/models"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"
)

var CreateFileToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "create_file",
			Description: param.NewOpt("Creates a new file in the Overleaf project. The file will be created in the appropriate folder based on the path. Note: The file will be created empty initially; use edit tools to add content after creation."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The path where the file should be created (e.g., 'sections/introduction.tex', 'figures/diagram.tex'). Use forward slashes for directory separators. The parent folder must exist.",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type CreateFileArgs struct {
	Path string `json:"path"`
}

type CreateFileTool struct {
	projectService *services.ProjectService
	overleafClient *overleaf.Client
}

func NewCreateFileTool(projectService *services.ProjectService) *CreateFileTool {
	return &CreateFileTool{
		projectService: projectService,
		overleafClient: overleaf.NewClient(),
	}
}

func (t *CreateFileTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var createArgs CreateFileArgs
	if err := json.Unmarshal(args, &createArgs); err != nil {
		return "", "", fmt.Errorf("invalid arguments: %w", err)
	}

	// Validate path
	if createArgs.Path == "" {
		return "", "", fmt.Errorf("path is required")
	}

	// Check Overleaf auth is available
	auth, err := contextutil.GetOverleafAuth(ctx)
	if err != nil {
		return "", "", fmt.Errorf("overleaf authentication required for create_file: %w", err)
	}

	// Get actor and project from context
	actor, projectId, _ := toolkit.GetActorProjectConversationID(ctx)
	if actor == nil || projectId == "" {
		return "", "", fmt.Errorf("failed to get actor or project id from context")
	}

	// Get project to find folder structure
	projectV2, err := t.projectService.GetProjectV2(ctx, actor.ID, projectId)
	if err != nil {
		return "", "", fmt.Errorf("failed to get project: %w", err)
	}

	// Check if file already exists
	normalizedPath := normalizePath(createArgs.Path)
	if t.fileExists(projectV2.RootFolder, normalizedPath) {
		return fmt.Sprintf("File already exists: %s", createArgs.Path), "", nil
	}

	// Resolve parent folder ID from path
	parentFolderID, err := t.resolveParentFolderID(projectV2, normalizedPath)
	if err != nil {
		return "", "", err
	}

	fileName := filepath.Base(normalizedPath)

	// Call Overleaf API to create the file
	resp, err := t.overleafClient.CreateDoc(ctx, &overleaf.CreateDocRequest{
		ParentFolderID: parentFolderID,
		Name:           fileName,
	})
	if err != nil {
		// Check for specific errors
		if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403") {
			return "", "", fmt.Errorf("overleaf authentication failed - session may have expired: %w", err)
		}
		return "", "", fmt.Errorf("failed to create file in Overleaf: %w", err)
	}

	result := fmt.Sprintf("Successfully created file '%s' (id: %s) at path '%s'.\n\nNote: The file is currently empty. To add content, use the appropriate edit tool after the document list is refreshed.",
		fileName, resp.ID, createArgs.Path)

	// Instruction for the LLM about next steps
	instruction := "The file has been created in Overleaf. The user's document list will be refreshed automatically. You can proceed with other tasks or wait for confirmation before editing the file content."

	_ = auth // Used for logging context, suppress unused warning

	return result, instruction, nil
}

// fileExists checks if a file already exists at the given path in the project
func (t *CreateFileTool) fileExists(folder *models.ProjectFolder, targetPath string) bool {
	if folder == nil {
		return false
	}
	return t.findDocInFolder(folder, targetPath, "") != nil
}

// findDocInFolder recursively searches for a document by path
func (t *CreateFileTool) findDocInFolder(folder *models.ProjectFolder, targetPath, currentPath string) *models.ProjectDoc {
	if folder == nil {
		return nil
	}

	// Build current path
	folderPath := currentPath
	if folder.Name != "" && folder.Name != "rootFolder" {
		if folderPath == "" {
			folderPath = folder.Name
		} else {
			folderPath = folderPath + "/" + folder.Name
		}
	}

	// Check docs in this folder
	for i := range folder.Docs {
		docPath := folderPath
		if docPath == "" {
			docPath = folder.Docs[i].Filepath
		} else {
			docPath = folderPath + "/" + filepath.Base(folder.Docs[i].Filepath)
		}
		docPath = normalizePath(docPath)

		if docPath == targetPath || normalizePath(folder.Docs[i].Filepath) == targetPath {
			return &folder.Docs[i]
		}
	}

	// Recurse into subfolders
	for i := range folder.Folders {
		if doc := t.findDocInFolder(&folder.Folders[i], targetPath, folderPath); doc != nil {
			return doc
		}
	}

	return nil
}

// resolveParentFolderID finds the folder ID for the parent directory of the given path
func (t *CreateFileTool) resolveParentFolderID(project *models.ProjectV2, targetPath string) (string, error) {
	if project.RootFolder == nil {
		return "", fmt.Errorf("project has no folder structure")
	}

	// Get directory part of the path
	dir := filepath.Dir(targetPath)

	// If creating in root, return root folder ID
	if dir == "." || dir == "/" || dir == "" {
		return project.RootFolder.ID, nil
	}

	// Clean and normalize the directory path
	dir = normalizePath(dir)

	// Find the folder by path
	folder := t.findFolderByPath(project.RootFolder, dir, "")
	if folder == nil {
		return "", fmt.Errorf("parent folder '%s' not found. Please create the folder first using create_folder tool, or create the file in the root directory", dir)
	}

	return folder.ID, nil
}

// findFolderByPath recursively finds a folder by its path
func (t *CreateFileTool) findFolderByPath(folder *models.ProjectFolder, targetPath, currentPath string) *models.ProjectFolder {
	if folder == nil {
		return nil
	}

	// Build current folder path
	folderPath := currentPath
	if folder.Name != "" && folder.Name != "rootFolder" {
		if folderPath == "" {
			folderPath = folder.Name
		} else {
			folderPath = folderPath + "/" + folder.Name
		}
	}

	// Check if this is the target folder
	if folderPath == targetPath {
		return folder
	}

	// Recurse into subfolders
	for i := range folder.Folders {
		if found := t.findFolderByPath(&folder.Folders[i], targetPath, folderPath); found != nil {
			return found
		}
	}

	return nil
}

// Legacy function for backward compatibility
func CreateFileTool_Legacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var createArgs CreateFileArgs
	if err := json.Unmarshal(args, &createArgs); err != nil {
		return "", "", err
	}
	return "", "", fmt.Errorf("create_file tool requires initialization with ProjectService")
}
