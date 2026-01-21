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

var CreateFolderToolDescriptionV2 = openai.ChatCompletionToolUnionParam{
	OfFunction: &openai.ChatCompletionFunctionToolParam{
		Function: openai.FunctionDefinitionParam{
			Name:        "create_folder",
			Description: param.NewOpt("Creates a new folder in the Overleaf project. The parent folder must exist. Use forward slashes for directory separators (e.g., 'sections/subsections')."),
			Parameters: openai.FunctionParameters{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]any{
						"type":        "string",
						"description": "The path where the folder should be created (e.g., 'sections', 'figures/diagrams'). Use forward slashes for directory separators. The parent folder must exist.",
					},
				},
				"required": []string{"path"},
			},
		},
	},
}

type CreateFolderArgs struct {
	Path string `json:"path"`
}

type CreateFolderTool struct {
	projectService *services.ProjectService
	overleafClient *overleaf.Client
}

func NewCreateFolderTool(projectService *services.ProjectService) *CreateFolderTool {
	return &CreateFolderTool{
		projectService: projectService,
		overleafClient: overleaf.NewClient(),
	}
}

func (t *CreateFolderTool) Call(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var createArgs CreateFolderArgs
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
		return "", "", fmt.Errorf("overleaf authentication required for create_folder: %w", err)
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

	// Normalize the path
	normalizedPath := normalizePath(createArgs.Path)

	// Check if folder already exists
	if t.folderExists(projectV2.RootFolder, normalizedPath) {
		return fmt.Sprintf("Folder already exists: %s", createArgs.Path), "", nil
	}

	// Resolve parent folder ID from path
	parentFolderID, err := t.resolveParentFolderID(projectV2, normalizedPath)
	if err != nil {
		return "", "", err
	}

	folderName := filepath.Base(normalizedPath)

	// Call Overleaf API to create the folder
	resp, err := t.overleafClient.CreateFolder(ctx, &overleaf.CreateFolderRequest{
		ParentFolderID: parentFolderID,
		Name:           folderName,
	})
	if err != nil {
		// Check for specific errors
		if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403") {
			return "", "", fmt.Errorf("overleaf authentication failed - session may have expired: %w", err)
		}
		return "", "", fmt.Errorf("failed to create folder in Overleaf: %w", err)
	}

	result := fmt.Sprintf("Successfully created folder '%s' (id: %s) at path '%s'.",
		folderName, resp.ID, createArgs.Path)

	instruction := "The folder has been created in Overleaf. The user's document list will be refreshed automatically. You can now create files inside this folder."

	_ = auth // Used for logging context, suppress unused warning

	return result, instruction, nil
}

// folderExists checks if a folder already exists at the given path in the project
func (t *CreateFolderTool) folderExists(folder *models.ProjectFolder, targetPath string) bool {
	if folder == nil {
		return false
	}
	return t.findFolderByPath(folder, targetPath, "") != nil
}

// findFolderByPath recursively finds a folder by its path
func (t *CreateFolderTool) findFolderByPath(folder *models.ProjectFolder, targetPath, currentPath string) *models.ProjectFolder {
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

// resolveParentFolderID finds the folder ID for the parent directory of the given path
func (t *CreateFolderTool) resolveParentFolderID(project *models.ProjectV2, targetPath string) (string, error) {
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
		return "", fmt.Errorf("parent folder '%s' not found. Please create the parent folder first, or create the folder in the root directory", dir)
	}

	return folder.ID, nil
}

// Legacy function for backward compatibility
func CreateFolderTool_Legacy(ctx context.Context, toolCallId string, args json.RawMessage) (string, string, error) {
	var createArgs CreateFolderArgs
	if err := json.Unmarshal(args, &createArgs); err != nil {
		return "", "", err
	}
	return "", "", fmt.Errorf("create_folder tool requires initialization with ProjectService")
}
