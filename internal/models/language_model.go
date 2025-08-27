package models

import (
	chatv1 "paperdebugger/pkg/gen/api/chat/v1"

	"github.com/openai/openai-go/v2"
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
	default:
		return openai.ChatModelGPT5
	}
}
