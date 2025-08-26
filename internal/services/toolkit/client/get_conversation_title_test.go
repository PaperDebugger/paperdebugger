package client_test

import (
	"context"
	"fmt"
	"os"
	"paperdebugger/internal/libs/cfg"
	"paperdebugger/internal/libs/db"
	"paperdebugger/internal/libs/logger"
	"paperdebugger/internal/services"
	"paperdebugger/internal/services/toolkit/client"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetConversationTitle_Case1(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	var dbInstance, _ = db.NewDB(cfg.GetCfg(), logger.GetLogger())
	var aiClient = client.NewAIClient(
		dbInstance,
		&services.ReverseCommentService{},
		&services.ProjectService{},
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	title, err := aiClient.GetConversationTitle(context.Background(), []*chatv1.Message{
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: "Can you explain how convolutional neural networks work?",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_Assistant{
					Assistant: &chatv1.MessageTypeAssistant{
						Content: "Convolutional Neural Networks (CNNs) are a type of deep learning model designed to process data with a grid-like structure, such as images. They work by using layers of filters (called convolutional layers) that automatically learn to detect patterns like edges, textures, and shapes by sliding over the input data and computing dot products. These filters capture spatial hierarchies of features through multiple layers—starting from simple patterns in early layers to complex structures in deeper layers. CNNs also use pooling layers to reduce the spatial dimensions, which helps with computational efficiency and generalization. Finally, fully connected layers at the end combine the learned features to perform tasks like classification or detection.",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: "Thanks. What are some common applications?",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_Assistant{
					Assistant: &chatv1.MessageTypeAssistant{},
				},
			},
		},
	})
	fmt.Println("Generated title:", title)

	assert.NoError(t, err)
	assert.True(t, strings.Contains(title, "CNN") || strings.Contains(title, "Convolutional Neural Network"))
}

func TestGetConversationTitle_Case2(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	var dbInstance, _ = db.NewDB(cfg.GetCfg(), logger.GetLogger())
	var aiClient = client.NewAIClient(
		dbInstance,
		&services.ReverseCommentService{},
		&services.ProjectService{},
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	title, err := aiClient.GetConversationTitle(context.Background(), []*chatv1.Message{
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: "Can you explain how virtual memory works in",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_Assistant{
					Assistant: &chatv1.MessageTypeAssistant{
						Content: "Sure! Virtual memory allows the system to use disk space as an extension of RAM. This helps programs use more memory than physically available.",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: "How does paging fit into this?",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_Assistant{
					Assistant: &chatv1.MessageTypeAssistant{
						Content: "Paging divides virtual memory into fixed-size pages, which are mapped to physical memory frames using a page table.",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: "What's the difference between paging and segmentation?",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_Assistant{
					Assistant: &chatv1.MessageTypeAssistant{
						Content: "Paging is based on fixed-size units, while segmentation uses variable-sized segments based on logical divisions in the program.",
					},
				},
			},
		},
	})
	fmt.Println("Generated title:", title)

	assert.NoError(t, err)
	assert.True(t,
		strings.Contains(title, "Virtual Memory") ||
			strings.Contains(title, "Paging") ||
			strings.Contains(title, "Segmentation"),
	)
}
func TestGetConversationTitle_Case3(t *testing.T) {
	os.Setenv("PD_MONGO_URI", "mongodb://localhost:27017")
	var dbInstance, _ = db.NewDB(cfg.GetCfg(), logger.GetLogger())
	var aiClient = client.NewAIClient(
		dbInstance,
		&services.ReverseCommentService{},
		&services.ProjectService{},
		cfg.GetCfg(),
		logger.GetLogger(),
	)
	title, err := aiClient.GetConversationTitle(context.Background(), []*chatv1.Message{
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: "Can you help me compare the performance of matrix multiplication using pure Python vs NumPy?",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_Assistant{
					Assistant: &chatv1.MessageTypeAssistant{
						Content: "Sure! Let's benchmark matrix multiplication using both methods. I'll generate random matrices and compare their runtime. First, how large do you want the matrices to be?",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_User{
					User: &chatv1.MessageTypeUser{
						Content: "Let’s try with 300x300.",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_ToolCall{
					ToolCall: &chatv1.MessageTypeToolCall{
						Name:   "benchmark_matrix_multiplication",
						Args:   "300, 300",
						Result: "NumPy: 100ms, Pure Python: 14.8s",
					},
				},
			},
		},
		{
			Payload: &chatv1.MessagePayload{
				MessageType: &chatv1.MessagePayload_Assistant{
					Assistant: &chatv1.MessageTypeAssistant{
						Content: "Here are the results:\nNumPy time: 0.04s\nPure Python time: 14.8s\nAs expected, NumPy is significantly faster due to its underlying C implementation and vectorization.",
					},
				},
			},
		},
	})
	fmt.Println("Generated title:", title)

	assert.NoError(t, err)
	assert.True(t, strings.Contains(title, "Matrix Multiplication"), title)
}
