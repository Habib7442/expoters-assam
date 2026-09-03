import { create } from "zustand";

export type SearchScope = "products" | "companies" | "buy-requirements";

type SearchState = {
  query: string;
  scope: SearchScope;
  setQuery: (query: string) => void;
  setScope: (scope: SearchScope) => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  scope: "products",
  setQuery: (query) => set({ query }),
  setScope: (scope) => set({ scope }),
}));
