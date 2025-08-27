import { create } from "zustand";
import { Prompt } from "../pkg/gen/apiclient/user/v1/user_pb";
import { listPrompts } from "../query/api";

type PromptLibraryStore = {
  prompts: Prompt[];
  setPrompts: (prompts: Prompt[]) => void;

  isLoading: boolean;
  loadPrompts: () => Promise<void>;

  searchPrompts: (query: string) => Prompt[];
};

export const usePromptLibraryStore = create<PromptLibraryStore>((set, get) => ({
  prompts: [],
  setPrompts: (prompts: Prompt[]) => set({ prompts }),

  isLoading: false,
  loadPrompts: async () => {
    set({ isLoading: true });
    const response = await listPrompts();
    set({ prompts: response.prompts || [], isLoading: false });
  },

  searchPrompts: (query: string) => {
    const prompts = get().prompts;
    return prompts.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));
  },
}));
