import { useCallback, useMemo } from "react";
import { SupportedModel } from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useConversationUiStore } from "../stores/conversation/conversation-ui-store";
import { useListSupportedModelsQuery } from "../query";

export type Model = {
  name: string;
  slug: string;
  provider: string;
};

// Extract provider from model slug (e.g., "openai/gpt-4.1" -> "openai")
const extractProvider = (slug: string): string => {
  const parts = slug.split("/");
  return parts.length > 1 ? parts[0] : "openai";
};

// Fallback models in case the API fails
const fallbackModels: Model[] = [
  {
    name: "GPT-4.1",
    slug: "openai/gpt-4.1",
    provider: "openai",
  },
];

const mapSupportedModelToModel = (supportedModel: SupportedModel): Model => ({
  name: supportedModel.name,
  slug: supportedModel.slug,
  provider: extractProvider(supportedModel.slug),
});

export const useLanguageModels = () => {
  const { currentConversation, setCurrentConversation } = useConversationStore();
  const { setLastUsedModelSlug } = useConversationUiStore();
  const { data: supportedModelsResponse } = useListSupportedModelsQuery();

  const models: Model[] = useMemo(() => {
    if (supportedModelsResponse?.models && supportedModelsResponse.models.length > 0) {
      return supportedModelsResponse.models.map(mapSupportedModelToModel);
    }
    return fallbackModels;
  }, [supportedModelsResponse]);

  const currentModel = useMemo(() => {
    const model = models.find((m) => m.slug === currentConversation.modelSlug);
    return model || models[0];
  }, [models, currentConversation.modelSlug]);

  const setModel = useCallback(
    (model: Model) => {
      setLastUsedModelSlug(model.slug);
      setCurrentConversation({
        ...currentConversation,
        modelSlug: model.slug,
      });
    },
    [setCurrentConversation, currentConversation, setLastUsedModelSlug],
  );

  return { models, currentModel, setModel };
};
