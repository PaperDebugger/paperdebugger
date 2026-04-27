import { useCallback, useEffect, useMemo } from "react";
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

// Extract provider from model slug (e.g., "openai/gpt-4.1" -> "openai")
const extractProvider = (slug: string): string => {
  const parts = slug.split("/");
  return parts.length > 1 ? parts[0] : "openai";
};

const normalizeModelId = (slug: string): string => slug.toLowerCase().trim().split("/").filter(Boolean).pop() ?? "";

const normalizeModelAlias = (slug: string): string => {
  const modelId = normalizeModelId(slug);
  if (modelId === "claude-4.6-opus") return "claude-opus-4.6";
  return modelId;
};

// Fallback models in case the API fails
const fallbackModels: Model[] = [
  {
    name: "GPT-5.4",
    slug: "openai/gpt-5.4",
    provider: "openai",
    totalContext: 1050000,
    maxOutput: 128000,
    inputPrice: 250,
    outputPrice: 1500,
    disabled: false,
  },
  {
    name: "GPT-5.4 Mini",
    slug: "openai/gpt-5.4-mini",
    provider: "openai",
    totalContext: 400000,
    maxOutput: 128000,
    inputPrice: 75,
    outputPrice: 450,
    disabled: false,
  },
  {
    name: "GPT-5.4 Nano",
    slug: "openai/gpt-5.4-nano",
    provider: "openai",
    totalContext: 400000,
    maxOutput: 128000,
    inputPrice: 20,
    outputPrice: 125,
    disabled: false,
  },
  {
    name: "Claude Opus 4.6",
    slug: "anthropic/claude-opus-4.6",
    provider: "anthropic",
    totalContext: 1000000,
    maxOutput: 128000,
    inputPrice: 500,
    outputPrice: 2500,
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
    const supportedModels = supportedModelsResponse?.models?.map(mapSupportedModelToModel) ?? [];
    const mergedModels = [...supportedModels];
    const seen = new Set(supportedModels.map((model) => normalizeModelAlias(model.slug)));

    for (const fallbackModel of fallbackModels) {
      const normalizedSlug = normalizeModelAlias(fallbackModel.slug);
      if (seen.has(normalizedSlug)) continue;
      mergedModels.push(fallbackModel);
      seen.add(normalizedSlug);
    }

    return mergedModels.length > 0 ? mergedModels : fallbackModels;
  }, [supportedModelsResponse]);

  const currentModel = useMemo(() => {
    const model = models.find((m) => m.slug === currentConversation.modelSlug);
    return model || models[0];
  }, [models, currentConversation.modelSlug]);

  useEffect(() => {
    if (!supportedModelsResponse?.models?.length) return;
    if (models.some((model) => model.slug === currentConversation.modelSlug)) return;

    const currentId = normalizeModelAlias(currentConversation.modelSlug);
    const matchingModel = models.find((model) => normalizeModelAlias(model.slug) === currentId) ?? models[0];
    if (!matchingModel || matchingModel.slug === currentConversation.modelSlug) return;

    setCurrentConversation({
      ...currentConversation,
      modelSlug: matchingModel.slug,
    });
    setLastUsedModelSlug(matchingModel.slug);
  }, [currentConversation, models, setCurrentConversation, setLastUsedModelSlug, supportedModelsResponse]);

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
