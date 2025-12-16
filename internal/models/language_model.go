package models

import (
	"errors"
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v3"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/x/bsonx/bsoncore"
)

type LanguageModel chatv1.LanguageModel

func (x LanguageModel) MarshalBSONValue() (bson.Type, []byte, error) {
	return bson.TypeString, bsoncore.AppendString(nil, chatv1.LanguageModel_name[int32(x)]), nil
}

func (x *LanguageModel) UnmarshalBSONValue(t bson.Type, data []byte) error {
	var v string
	err := bson.Unmarshal(data, &v)
	if err != nil {
		return err
	}
	*x = LanguageModel(chatv1.LanguageModel_value[v])
	return nil
}

func (x LanguageModel) Name() (string, error) {
	switch chatv1.LanguageModel(x) {
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT4O:
		return "openai/" + openai.ChatModelGPT4o, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41:
		return "openai/" + openai.ChatModelGPT4_1, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI:
		return "openai/" + openai.ChatModelGPT4_1Mini, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5:
		return "openai/" + openai.ChatModelGPT5, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_MINI:
		return "openai/" + openai.ChatModelGPT5Mini, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_NANO:
		return "openai/" + openai.ChatModelGPT5Nano, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_CHAT_LATEST:
		return "openai/" + openai.ChatModelGPT5ChatLatest, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O1:
		return "openai/" + openai.ChatModelO1, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O1_MINI:
		return "openai/" + openai.ChatModelO1Mini, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O3:
		return "openai/" + openai.ChatModelO3, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O3_MINI:
		return "openai/" + openai.ChatModelO3Mini, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O4_MINI:
		return "openai/" + openai.ChatModelO4Mini, nil
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_CODEX_MINI_LATEST:
		return "openai/" + openai.ChatModelCodexMiniLatest, nil
	default:
		// raise error
		return "", errors.New("unknown model")
	}
}

func (x LanguageModel) FromSlug(slug string) LanguageModel {
	switch slug {
	case "openai/gpt-4o":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT4O)
	case "openai/gpt-4.1":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41)
	case "openai/gpt-4.1-mini":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI)
	case "openai/gpt-5":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5)
	case "openai/gpt-5-mini":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_MINI)
	case "openai/gpt-5-nano":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_NANO)
	case "openai/gpt-5-chat-latest":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_CHAT_LATEST)
	case "openai/o1":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O1)
	case "openai/o1-mini":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O1_MINI)
	case "openai/o3":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O3)
	case "openai/o3-mini":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O3_MINI)
	case "openai/o4-mini":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O4_MINI)
	case "openai/codex-mini-latest":
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_CODEX_MINI_LATEST)
	default:
		return LanguageModel(chatv1.LanguageModel_LANGUAGE_MODEL_UNSPECIFIED)
	}
}
