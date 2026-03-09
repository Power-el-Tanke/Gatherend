import { create } from "zustand";

/**
 * Store para trackear suscripciones activas de conversaciones (DM heavy stream).
 *
 * Arquitectura (Option A):
 * - Al entrar a un DM, se marca como "suscrito" (join-conversation)
 * - La suscripción se mantiene mientras exista la query flag en React Query
 * - Cuando gcTime expira o se aplica un límite N (LRU), se elimina la query:
 *   -> el sync hook emite leave-conversation y limpia el store
 */

export const MAX_SUBSCRIBED_CONVERSATIONS = 10;

interface ConversationSubscriptionState {
  subscribedConversations: Set<string>;
  /**
   * LRU (most-recent first). Not authoritative for lifecycle; used to compute
   * eviction candidates when enforcing `MAX_SUBSCRIBED_CONVERSATIONS`.
   */
  lru: string[];

  subscribe: (conversationId: string) => { overflow: string[] };
  unsubscribe: (conversationId: string) => void;
  isSubscribed: (conversationId: string) => boolean;
  getSubscribedConversations: () => string[];
  clear: () => void;
}

export const useConversationSubscriptionStore =
  create<ConversationSubscriptionState>((set, get) => ({
    subscribedConversations: new Set(),
    lru: [],

    subscribe: (conversationId: string) => {
      const state = get();
      const currentSet = state.subscribedConversations;
      const currentLru = state.lru;

      const nextSet = currentSet.has(conversationId)
        ? currentSet
        : new Set(currentSet);
      if (!currentSet.has(conversationId)) nextSet.add(conversationId);

      const nextLru = [
        conversationId,
        ...currentLru.filter((id) => id !== conversationId),
      ];

      const overflow = nextLru.slice(MAX_SUBSCRIBED_CONVERSATIONS);

      if (nextSet !== currentSet || nextLru !== currentLru) {
        set({ subscribedConversations: nextSet, lru: nextLru });
      }

      return { overflow };
    },

    unsubscribe: (conversationId: string) => {
      const state = get();
      const currentSet = state.subscribedConversations;
      if (!currentSet.has(conversationId)) return;

      const nextSet = new Set(currentSet);
      nextSet.delete(conversationId);
      const nextLru = state.lru.filter((id) => id !== conversationId);
      set({ subscribedConversations: nextSet, lru: nextLru });
    },

    isSubscribed: (conversationId: string) => {
      return get().subscribedConversations.has(conversationId);
    },

    getSubscribedConversations: () => {
      return Array.from(get().subscribedConversations);
    },

    clear: () => {
      set({ subscribedConversations: new Set(), lru: [] });
    },
  }));

