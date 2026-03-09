import { create } from "zustand";

interface ScrollToBottomStore {
  scrollTrigger: number;
  triggerScroll: () => void;
}

export const useScrollToBottom = create<ScrollToBottomStore>((set) => ({
  scrollTrigger: 0,
  triggerScroll: () =>
    set((state) => ({ scrollTrigger: state.scrollTrigger + 1 })),
}));
