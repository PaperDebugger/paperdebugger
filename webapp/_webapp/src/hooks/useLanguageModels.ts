import { useCallback, useMemo } from "react";
import { LanguageModel } from "../pkg/gen/apiclient/chat/v1/chat_pb";
import { useConversationStore } from "../stores/conversation/conversation-store";

export type Model = {
  name: string;
  description: string;
  languageModel: LanguageModel;
};

export const useLanguageModels = () => {
  const { currentConversation, setCurrentConversation } = useConversationStore();

  const models: Model[] = useMemo(
    () => [
      {
        name: "GPT-4o",
        description: "OpenAI GPT-4o",
        languageModel: LanguageModel.OPENAI_GPT4O,
      },
      {
        name: "GPT-4.1",
        description: "OpenAI GPT-4.1",
        languageModel: LanguageModel.OPENAI_GPT41,
      },
      // {
      //   name: "GPT-5",
      //   description: "OpenAI GPT-5",
      //   languageModel: LanguageModel.OPENAI_GPT5,
      // },
      // {
      //   name: "GPT-5-mini",
      //   description: "OpenAI GPT-5-mini",
      //   languageModel: LanguageModel.OPENAI_GPT5_MINI,
      // },
      // {
      //   name: "GPT-5-nano",
      //   description: "OpenAI GPT-5-nano",
      //   languageModel: LanguageModel.OPENAI_GPT5_NANO,
      // },
    ],
    [],
  );

  const currentModel = useMemo(() => {
    const model = models.find((m) => m.languageModel === currentConversation.languageModel);
    return model || models[2];
  }, [models, currentConversation.languageModel]);

  const setModel = useCallback(
    (model: Model) => {
      setCurrentConversation({
        ...currentConversation,
        languageModel: model.languageModel,
      });
    },
    [setCurrentConversation, currentConversation],
  );

  return { models, currentModel, setModel };
};
