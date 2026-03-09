"use client";

import { create } from "zustand";

/**
 * Store global para navegación SPA
 *
 * Este store permite que componentes fuera del BoardSwitchProvider
 * (como modales) puedan triggear navegación SPA.
 *
 * El BoardSwitchProvider registra sus funciones de navegación aquí,
 * y otros componentes pueden llamarlas sin necesitar acceso directo al contexto.
 */

type SwitchBoardOptions = {
  history?: "push" | "replace";
};

interface NavigationState {

  // Funciones de navegación registradas por BoardSwitchProvider
  switchBoard: ((
    boardId: string,
    channelId?: string,
    options?: SwitchBoardOptions,
  ) => void) | null;
  switchChannel: ((channelId: string) => void) | null;
  switchConversation: ((conversationId: string) => void) | null;
  switchToDiscovery: (() => void) | null;
  switchToCommunityBoards: ((communityId: string) => void) | null;

  // Registrar funciones (llamado por BoardSwitchProvider)
  registerNavigation: (fns: {
    switchBoard: (
      boardId: string,
      channelId?: string,
      options?: SwitchBoardOptions,
    ) => void;
    switchChannel: (channelId: string) => void;
    switchConversation: (conversationId: string) => void;
    switchToDiscovery: () => void;
    switchToCommunityBoards: (communityId: string) => void;
  }) => void;

  // Limpiar funciones (llamado cuando BoardSwitchProvider se desmonta)
  unregisterNavigation: () => void;

  // Helper para saber si la navegación SPA está disponible
  isNavigationReady: () => boolean;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  switchBoard: null,
  switchChannel: null,
  switchConversation: null,
  switchToDiscovery: null,
  switchToCommunityBoards: null,

  registerNavigation: (fns) =>
    set({
      switchBoard: fns.switchBoard,
      switchChannel: fns.switchChannel,
      switchConversation: fns.switchConversation,
      switchToDiscovery: fns.switchToDiscovery,
      switchToCommunityBoards: fns.switchToCommunityBoards,
    }),

  unregisterNavigation: () =>
    set({
      switchBoard: null,
      switchChannel: null,
      switchConversation: null,
      switchToDiscovery: null,
      switchToCommunityBoards: null,
    }),

  isNavigationReady: () => {
    const state = get();
    return (
      state.switchBoard !== null &&
      state.switchChannel !== null &&
      state.switchConversation !== null &&
      state.switchToDiscovery !== null &&
      state.switchToCommunityBoards !== null
    );
  },
}));
