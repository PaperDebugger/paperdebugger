package models

import (
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

func (x LanguageModel) Name() string {
	switch chatv1.LanguageModel(x) {
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT4O:
		return openai.ChatModelGPT4o
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41:
		return openai.ChatModelGPT4_1
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT41_MINI:
		return openai.ChatModelGPT4_1Mini
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5:
		return openai.ChatModelGPT5
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_MINI:
		return openai.ChatModelGPT5Mini
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_NANO:
		return openai.ChatModelGPT5Nano
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_GPT5_CHAT_LATEST:
		return openai.ChatModelGPT5ChatLatest
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O1:
		return openai.ChatModelO1
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O1_MINI:
		return openai.ChatModelO1Mini
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O3:
		return openai.ChatModelO3
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O3_MINI:
		return openai.ChatModelO3Mini
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_O4_MINI:
		return openai.ChatModelO4Mini
	case chatv1.LanguageModel_LANGUAGE_MODEL_OPENAI_CODEX_MINI_LATEST:
		return openai.ChatModelCodexMiniLatest
	default:
		return openai.ChatModelGPT5
	}
}
