"use client";

import { create } from "zustand";

interface MobileDrawerStore {
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  closeAll: () => void;
}

export const useMobileDrawerStore = create<MobileDrawerStore>((set) => ({
  leftOpen: false,
  rightOpen: false,
  setLeftOpen: (open) => set({ leftOpen: open }),
  setRightOpen: (open) => set({ rightOpen: open }),
  closeAll: () => set({ leftOpen: false, rightOpen: false }),
}));

