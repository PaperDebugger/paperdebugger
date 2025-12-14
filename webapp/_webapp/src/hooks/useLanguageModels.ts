import { useCallback, useMemo } from "react";
import { SupportedModel } from "../pkg/gen/apiclient/chat/v1/chat_pb";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useListSupportedModelsQuery } from "../query";

export type Model = {
  name: string;
  slug: string;
};

// Fallback models in case the API fails
const fallbackModels: Model[] = [
  {
    name: "GPT-4.1",
    slug: "gpt-4.1",
  },
];

const mapSupportedModelToModel = (supportedModel: SupportedModel): Model => ({
  name: supportedModel.name,
  slug: supportedModel.slug,
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
    // Get the current model slug from the conversation
    let slug: string;
    if (currentConversation.model.case === "modelSlug" && currentConversation.model.value) {
      slug = currentConversation.model.value;
    } else {
      slug = "gpt-4.1"; // default for undefined, empty string, or legacy languageModel
    }
    const model = models.find((m) => m.slug === slug);
    return model || models[0];
  }, [models, currentConversation.model]);

  const setModel = useCallback(
    (model: Model) => {
      setCurrentConversation({
        ...currentConversation,
        model: { case: "modelSlug", value: model.slug },
      });
    },
    [setCurrentConversation, currentConversation],
  );

  return { models, currentModel, setModel };
};
