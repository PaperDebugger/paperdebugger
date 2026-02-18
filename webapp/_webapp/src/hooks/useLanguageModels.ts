import { useCallback, useMemo } from "react";
import { SupportedModel } from "../pkg/gen/apiclient/chat/v2/chat_pb";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useListSupportedModelsQuery } from "../query";
import { useConversationUiStore } from "../stores/conversation/conversation-ui-store";

export type Model = {
  name: string;
  slug: string;
  provider: string;
  totalContext: number;
  maxOutput: number;
  inputPrice: number;
  outputPrice: number;
  disabled: boolean;
  disabledReason?: string;
};

// Extract provider from model slug (e.g., "openai/gpt-5.1" -> "openai")
const extractProvider = (slug: string): string => {
  const parts = slug.split("/");
  return parts.length > 1 ? parts[0] : "openai";
};

// Fallback models in case the API fails
const fallbackModels: Model[] = [
  {
    name: "GPT-5.1",
    slug: "openai/gpt-5.1",
    provider: "openai",
    totalContext: 400000,
    maxOutput: 128000,
    inputPrice: 125,
    outputPrice: 1000,
    disabled: false,
  },
];

const mapSupportedModelToModel = (supportedModel: SupportedModel): Model => ({
  name: supportedModel.name,
  slug: supportedModel.slug,
  provider: extractProvider(supportedModel.slug),
  totalContext: Number(supportedModel.totalContext),
  maxOutput: Number(supportedModel.maxOutput),
  inputPrice: Number(supportedModel.inputPrice),
  outputPrice: Number(supportedModel.outputPrice),
  disabled: supportedModel.disabled,
  disabledReason: supportedModel.disabledReason,
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
