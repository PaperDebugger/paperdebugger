import { useCallback, useMemo } from "react";
import { LanguageModel, SupportedModel } from "../pkg/gen/apiclient/chat/v1/chat_pb";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useListSupportedModelsQuery } from "../query";

export type Model = {
  name: string;
  slug: string;
  languageModel: LanguageModel;
};

const slugToLanguageModel = (slug: string) => {
  switch (slug) {
    case "gpt-4.1":
      return LanguageModel.OPENAI_GPT41;
    case "gpt-4o":
      return LanguageModel.OPENAI_GPT4O;
    case "gpt-4.1-mini":
      return LanguageModel.OPENAI_GPT41_MINI;
    case "gpt-5":
      return LanguageModel.OPENAI_GPT5;
    case "gpt-5-mini":
      return LanguageModel.OPENAI_GPT5_MINI;
    case "gpt-5-nano":
      return LanguageModel.OPENAI_GPT5_NANO;
    case "gpt-5-chat-latest":
      return LanguageModel.OPENAI_GPT5_CHAT_LATEST;
    case "o1":
      return LanguageModel.OPENAI_O1;
    case "o1-mini":
      return LanguageModel.OPENAI_O1_MINI;
    case "o3":
      return LanguageModel.OPENAI_O3;
    case "o3-mini":
      return LanguageModel.OPENAI_O3_MINI;
    case "o4-mini":
      return LanguageModel.OPENAI_O4_MINI;
    case "codex-mini-latest":
      return LanguageModel.OPENAI_CODEX_MINI_LATEST;
    default:
      return LanguageModel.OPENAI_GPT41;
  }
};

const languageModelToSlug = (languageModel: LanguageModel) => {
  switch (languageModel) {
    case LanguageModel.OPENAI_GPT41:
      return "gpt-4.1";
    case LanguageModel.OPENAI_GPT4O:
      return "gpt-4o";
    case LanguageModel.OPENAI_GPT41_MINI:
      return "gpt-4.1-mini";
    case LanguageModel.OPENAI_GPT5:
      return "gpt-5";
    case LanguageModel.OPENAI_GPT5_MINI:
      return "gpt-5-mini";
    case LanguageModel.OPENAI_GPT5_NANO:
      return "gpt-5-nano";
    case LanguageModel.OPENAI_GPT5_CHAT_LATEST:
      return "gpt-5-chat-latest";
    case LanguageModel.OPENAI_O1:
      return "o1";
    case LanguageModel.OPENAI_O1_MINI:
      return "o1-mini";
    case LanguageModel.OPENAI_O3:
      return "o3";
    case LanguageModel.OPENAI_O3_MINI:
      return "o3-mini";
    case LanguageModel.OPENAI_O4_MINI:
      return "o4-mini";
    case LanguageModel.OPENAI_CODEX_MINI_LATEST:
      return "codex-mini-latest";
    default:
      return "gpt-4.1";
  }
};

// Fallback models in case the API fails
const fallbackModels: Model[] = [
  {
    name: "GPT-4.1",
    slug: "gpt-4.1",
    languageModel: LanguageModel.OPENAI_GPT41,
  },
];

const mapSupportedModelToModel = (supportedModel: SupportedModel): Model => ({
  name: supportedModel.name,
  slug: supportedModel.slug,
  languageModel: slugToLanguageModel(supportedModel.slug),
});

export const useLanguageModels = () => {
  const { currentConversation, setCurrentConversation } = useConversationStore();
  const { data: supportedModelsResponse } = useListSupportedModelsQuery();

  const models: Model[] = useMemo(() => {
    if (supportedModelsResponse?.models && supportedModelsResponse.models.length > 0) {
      return supportedModelsResponse.models.map(mapSupportedModelToModel);
    }
    return fallbackModels;
  }, [supportedModelsResponse]);

  const currentModel = useMemo(() => {
    const model = models.find((m) => m.slug === languageModelToSlug(currentConversation.languageModel));
    return model || models[0];
  }, [models, currentConversation.languageModel]);

  const setModel = useCallback(
    (model: Model) => {
      setCurrentConversation({
        ...currentConversation,
        languageModel: slugToLanguageModel(model.slug),
      });
    },
    [setCurrentConversation, currentConversation],
  );

  return { models, currentModel, setModel };
};
