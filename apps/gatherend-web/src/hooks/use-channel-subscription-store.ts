import { create } from "zustand";

/**
 * Store para trackear las suscripciones activas de canales.
 *
 * Arquitectura:
 * - El usuario se suscribe a un canal cuando lo visita (join-channel)
 * - La suscripción se mantiene mientras el caché exista en React Query
 * - Cuando gcTime expira y el caché es eliminado, se hace leave-channel
 *
 * Esto permite que los mensajes nuevos actualicen el caché incluso
 * cuando el usuario navega a otro canal del mismo board.
 */

interface ChannelSubscriptionState {
  // Set de channelIds suscritos
  subscribedChannels: Set<string>;
  /**
   * LRU (most-recent first). Used to compute eviction candidates when enforcing
   * a max number of subscribed channels.
   */
  lru: string[];

  // Acciones
  subscribe: (channelId: string) => { overflow: string[] };
  unsubscribe: (channelId: string) => void;
  isSubscribed: (channelId: string) => boolean;
  getSubscribedChannels: () => string[];
  clear: () => void;
}

export const MAX_SUBSCRIBED_CHANNELS = 15;

export const useChannelSubscriptionStore = create<ChannelSubscriptionState>(
  (set, get) => ({
    subscribedChannels: new Set(),
    lru: [],

    subscribe: (channelId: string) => {
      const state = get();
      const currentSet = state.subscribedChannels;
      const currentLru = state.lru;

      const nextSet = currentSet.has(channelId)
        ? currentSet
        : new Set(currentSet);
      if (!currentSet.has(channelId)) nextSet.add(channelId);

      const nextLru = [
        channelId,
        ...currentLru.filter((id) => id !== channelId),
      ];

      const overflow = nextLru.slice(MAX_SUBSCRIBED_CHANNELS);

      if (nextSet !== currentSet || nextLru !== currentLru) {
        set({ subscribedChannels: nextSet, lru: nextLru });
      }

      return { overflow };
    },

    unsubscribe: (channelId: string) => {
      const current = get().subscribedChannels;
      if (!current.has(channelId)) return;

      const updated = new Set(current);
      updated.delete(channelId);
      const nextLru = get().lru.filter((id) => id !== channelId);
      set({ subscribedChannels: updated, lru: nextLru });
    },

    isSubscribed: (channelId: string) => {
      return get().subscribedChannels.has(channelId);
    },

    getSubscribedChannels: () => {
      return Array.from(get().subscribedChannels);
    },

    clear: () => {
      set({ subscribedChannels: new Set(), lru: [] });
    },
  }),
);
