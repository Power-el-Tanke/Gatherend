"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { logger } from "@/lib/logger";
import { useNavigationStore } from "@/hooks/use-navigation-store";

// LocalStorage helpers para memoria de último channel por board

const LAST_CHANNEL_STORAGE_KEY = "gatherend:lastChannel";

function saveLastChannelForBoard(boardId: string, channelId: string): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_STORAGE_KEY);
    const data: Record<string, string> = stored ? JSON.parse(stored) : {};
    data[boardId] = channelId;
    localStorage.setItem(LAST_CHANNEL_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    logger.warn("Failed to save last channel to localStorage:", error);
  }
}

export function getLastChannelForBoard(boardId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_STORAGE_KEY);
    if (!stored) return null;
    const data: Record<string, string> = JSON.parse(stored);
    return data[boardId] || null;
  } catch (error) {
    logger.warn("Failed to read last channel from localStorage:", error);
    return null;
  }
}

// Types

interface NavigationState {
  currentBoardId: string;
  currentChannelId: string | null;
  currentConversationId: string | null;
  currentCommunityId: string | null;
  isDiscovery: boolean;
}

type SwitchBoardOptions = {
  history?: "push" | "replace";
};

interface BoardNavigationStore extends NavigationState {
  // Initialization
  isInitialized: boolean;
  isClientNavigationEnabled: boolean;

  // Actions
  initializeFromUrl: () => void;
  switchBoard: (
    boardId: string,
    channelId?: string,
    options?: SwitchBoardOptions,
  ) => void;
  switchChannel: (channelId: string) => void;
  switchConversation: (conversationId: string) => void;
  switchToDiscovery: () => void;
  switchToCommunityBoards: (communityId: string) => void;

  // Internal - for popstate sync
  _syncFromPopstate: (state: NavigationState) => void;
}

// URL Parser

function parseUrlToState(): NavigationState {
  if (typeof window === "undefined") {
    return {
      currentBoardId: "",
      currentChannelId: null,
      currentConversationId: null,
      currentCommunityId: null,
      isDiscovery: false,
    };
  }

  const pathParts = window.location.pathname.split("/");
  const boardIndex = pathParts.indexOf("boards");

  if (boardIndex === -1 || !pathParts[boardIndex + 1]) {
    return {
      currentBoardId: "",
      currentChannelId: null,
      currentConversationId: null,
      currentCommunityId: null,
      isDiscovery: false,
    };
  }

  const boardId = pathParts[boardIndex + 1];
  const state: NavigationState = {
    currentBoardId: boardId,
    currentChannelId: null,
    currentConversationId: null,
    currentCommunityId: null,
    isDiscovery: false,
  };

  const discoveryIndex = pathParts.indexOf("discovery");
  if (discoveryIndex !== -1) {
    state.isDiscovery = true;
    const communitiesIndex = pathParts.indexOf("communities");
    if (communitiesIndex !== -1 && pathParts[communitiesIndex + 1]) {
      state.currentCommunityId = pathParts[communitiesIndex + 1];
    }
  } else {
    const roomsIndex = pathParts.indexOf("rooms");
    if (roomsIndex !== -1 && pathParts[roomsIndex + 1]) {
      state.currentChannelId = pathParts[roomsIndex + 1];
    } else {
      const conversationIndex = pathParts.indexOf("conversations");
      if (conversationIndex !== -1 && pathParts[conversationIndex + 1]) {
        state.currentConversationId = pathParts[conversationIndex + 1];
      }
    }
  }

  return state;
}

// Store

// Parse URL immediately on module load (client-side only)
const initialState =
  typeof window !== "undefined"
    ? parseUrlToState()
    : {
        currentBoardId: "",
        currentChannelId: null,
        currentConversationId: null,
        currentCommunityId: null,
        isDiscovery: false,
      };

export const useBoardNavigationStore = create<BoardNavigationStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state parsed from URL immediately (no need to wait for effect)
    ...initialState,
    isInitialized: typeof window !== "undefined", // Already initialized if on client
    isClientNavigationEnabled: false,

    initializeFromUrl: () => {
      const state = get();
      // Keep store routing aligned with current URL on each provider mount.
      const urlState = parseUrlToState();
      const needsSync =
        !state.isInitialized ||
        state.currentBoardId !== urlState.currentBoardId ||
        state.currentChannelId !== urlState.currentChannelId ||
        state.currentConversationId !== urlState.currentConversationId ||
        state.currentCommunityId !== urlState.currentCommunityId ||
        state.isDiscovery !== urlState.isDiscovery;

      if (needsSync) {
        set({
          ...urlState,
          isInitialized: true,
        });
      }

      if (state.isClientNavigationEnabled) return;

      // Enable client navigation after a tick (to allow hydration)
      setTimeout(() => {
        set({ isClientNavigationEnabled: true });
      }, 0);

      // Setup popstate listener once
      const handlePopState = (event: PopStateEvent) => {
        if (event.state?.boardId) {
          get()._syncFromPopstate({
            currentBoardId: event.state.boardId,
            currentChannelId: event.state.channelId || null,
            currentConversationId: event.state.conversationId || null,
            currentCommunityId: event.state.communityId || null,
            isDiscovery: event.state.isDiscovery || false,
          });
        } else {
          // Fallback: parse URL
          get()._syncFromPopstate(parseUrlToState());
        }
      };

      window.addEventListener("popstate", handlePopState);

      // Register navigation functions in the legacy navigation store
      // This allows components outside the provider (like modals) to navigate
      const actions = get();
      useNavigationStore.getState().registerNavigation({
        switchBoard: actions.switchBoard,
        switchChannel: actions.switchChannel,
        switchConversation: actions.switchConversation,
        switchToDiscovery: actions.switchToDiscovery,
        switchToCommunityBoards: actions.switchToCommunityBoards,
      });

    },

    switchBoard: (boardId, channelId, options) => {
      const state = get();
      if (boardId === state.currentBoardId && !channelId) return;

      set({
        currentBoardId: boardId,
        currentChannelId: channelId || null,
        currentConversationId: null,
        currentCommunityId: null,
        isDiscovery: false,
      });

      const targetUrl = channelId
        ? `/boards/${boardId}/rooms/${channelId}`
        : `/boards/${boardId}`;
      const targetState = channelId ? { boardId, channelId } : { boardId };
      const historyMode = options?.history ?? "push";
      const shouldReplace = historyMode === "replace";
      const isSamePath = window.location.pathname === targetUrl;
      const currentHistoryState = (window.history.state ?? {}) as Record<
        string,
        unknown
      >;
      const isSameHistoryState =
        currentHistoryState.boardId === boardId &&
        (channelId ? currentHistoryState.channelId === channelId : true);

      // Avoid duplicate history entries when URL was already updated optimistically.
      if (!isSamePath) {
        if (shouldReplace) {
          window.history.replaceState(targetState, "", targetUrl);
        } else {
          window.history.pushState(targetState, "", targetUrl);
        }
      } else if (shouldReplace) {
        // Keep history.state in sync even if path did not change, but avoid
        // redundant writes that overwrite Next's internal router state.
        if (!isSameHistoryState) {
          // Preserve Next's internal router fields (e.g. __NA / __PRIVATE_NEXTJS_INTERNALS_TREE)
          // so we don't trigger a follow-up replaceState from Next.
          const mergedState: Record<string, unknown> = {
            ...currentHistoryState,
            ...targetState,
          };
          window.history.replaceState(mergedState, "", targetUrl);
        }
      }
    },

    switchChannel: (channelId) => {
      const state = get();
      if (channelId === state.currentChannelId && !state.isDiscovery) return;

      set({
        currentChannelId: channelId,
        currentConversationId: null,
        isDiscovery: false,
      });

      window.history.pushState(
        { boardId: state.currentBoardId, channelId },
        "",
        `/boards/${state.currentBoardId}/rooms/${channelId}`,
      );

      saveLastChannelForBoard(state.currentBoardId, channelId);
    },

    switchConversation: (conversationId) => {
      const state = get();
      if (conversationId === state.currentConversationId && !state.isDiscovery)
        return;

      set({
        currentConversationId: conversationId,
        currentChannelId: null,
        isDiscovery: false,
      });

      window.history.pushState(
        { boardId: state.currentBoardId, conversationId },
        "",
        `/boards/${state.currentBoardId}/conversations/${conversationId}`,
      );
    },

    switchToDiscovery: () => {
      const state = get();
      if (state.isDiscovery && !state.currentCommunityId) return;

      set({
        currentChannelId: null,
        currentConversationId: null,
        currentCommunityId: null,
        isDiscovery: true,
      });

      window.history.pushState(
        { boardId: state.currentBoardId, isDiscovery: true },
        "",
        `/boards/${state.currentBoardId}/discovery`,
      );
    },

    switchToCommunityBoards: (communityId) => {
      const state = get();
      if (state.currentCommunityId === communityId) return;

      set({
        currentChannelId: null,
        currentConversationId: null,
        currentCommunityId: communityId,
        isDiscovery: true,
      });

      window.history.pushState(
        { boardId: state.currentBoardId, communityId, isDiscovery: true },
        "",
        `/boards/${state.currentBoardId}/discovery/communities/${communityId}`,
      );
    },

    _syncFromPopstate: (newState) => {
      set(newState);
    },
  })),
);

// Selectors (for optimal re-render control)

/**
 * Selector for routing state only.
 * Components using this only re-render when navigation state changes.
 */
export const selectRouting = (state: BoardNavigationStore) => ({
  currentBoardId: state.currentBoardId,
  currentChannelId: state.currentChannelId,
  currentConversationId: state.currentConversationId,
  currentCommunityId: state.currentCommunityId,
  isDiscovery: state.isDiscovery,
});

/**
 * Selector for navigation actions only.
 * These never change, so components using this never re-render from store changes.
 */
export const selectActions = (state: BoardNavigationStore) => ({
  switchBoard: state.switchBoard,
  switchChannel: state.switchChannel,
  switchConversation: state.switchConversation,
  switchToDiscovery: state.switchToDiscovery,
  switchToCommunityBoards: state.switchToCommunityBoards,
  isClientNavigationEnabled: state.isClientNavigationEnabled,
});

/**
 * Individual selectors for maximum granularity
 */
export const selectCurrentBoardId = (state: BoardNavigationStore) =>
  state.currentBoardId;
export const selectCurrentChannelId = (state: BoardNavigationStore) =>
  state.currentChannelId;
export const selectCurrentConversationId = (state: BoardNavigationStore) =>
  state.currentConversationId;
export const selectIsDiscovery = (state: BoardNavigationStore) =>
  state.isDiscovery;
export const selectIsInitialized = (state: BoardNavigationStore) =>
  state.isInitialized;
