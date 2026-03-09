import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useChannelSubscriptionStore } from "./use-channel-subscription-store";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";

/**
 * Hook que sincroniza las suscripciones de socket con el caché de React Query.
 *
 * Cuando React Query elimina un caché de chat (por gcTime), este hook
 * automáticamente emite leave-channel para limpiar la suscripción del socket.
 *
 * Debe ser llamado una vez en un componente de alto nivel (ej: AppShell).
 */
export function useChannelSubscriptionSync() {
  const queryClient = useQueryClient();
  const { socket } = useSocketClient();
  const pendingLeavesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    if (!socket) return;

    const queryCache = queryClient.getQueryCache();
    const pendingLeaves = pendingLeavesRef.current;

    const getChatRoomFromQueryKey = (
      queryKey: readonly unknown[],
    ): { roomType: "channel"; roomId: string } | null => {
      if (queryKey[0] !== "chat") return null;
      if (queryKey[1] !== "channel") return null;
      if (typeof queryKey[2] !== "string") return null;
      return { roomType: "channel", roomId: queryKey[2] };
    };

    const cancelPendingLeave = (channelId: string) => {
      const timer = pendingLeaves.get(channelId);
      if (timer) {
        clearTimeout(timer);
        pendingLeaves.delete(channelId);
      }
    };

    const scheduleLeave = (channelId: string) => {
      // Only schedule if the channel is still tracked as subscribed.
      if (!useChannelSubscriptionStore.getState().isSubscribed(channelId)) return;

      cancelPendingLeave(channelId);

      // Removed can be caused by manual removeQueries() as well.
      // Wait briefly and verify query is still absent before leaving the room.
      const timer = setTimeout(() => {
        const stillExists = queryCache.find({
          queryKey: ["chat", "channel", channelId],
          exact: true,
        });
        if (stillExists) {
          pendingLeaves.delete(channelId);
          return;
        }

        const store = useChannelSubscriptionStore.getState();
        if (!store.isSubscribed(channelId)) {
          pendingLeaves.delete(channelId);
          return;
        }

        if (socket.connected) {
          socket.emit("leave-channel", { channelId });
        } else {
        }

        store.unsubscribe(channelId);
        chatMessageWindowStore.deleteIfUnused(`chatWindow:channel:${channelId}`);
        pendingLeaves.delete(channelId);
      }, 1200);

      pendingLeaves.set(channelId, timer);
    };

    // Suscribirse a eventos del cache
    const unsubscribeFromCache = queryCache.subscribe((event) => {
      const queryKey = event.query.queryKey;
      const room = getChatRoomFromQueryKey(queryKey);
      if (!room) return;

      const channelId = room.roomId;

      // Recreated/updated query: cancel pending leave.
      if (event.type === "added" || event.type === "updated") {
        cancelPendingLeave(channelId);
        return;
      }

      // Removed query: schedule guarded leave.
      if (event.type === "removed") {
        scheduleLeave(channelId);
      }
    });

    return () => {
      pendingLeaves.forEach((timer) => clearTimeout(timer));
      pendingLeaves.clear();
      unsubscribeFromCache();
    };
  }, [socket, queryClient]);
}

/**
 * Hook para hacer leave-channel de todos los canales suscritos.
 * Útil para limpiar al hacer logout.
 */
export function useChannelSubscriptionCleanup() {
  const { socket } = useSocketClient();
  const { getSubscribedChannels, clear } = useChannelSubscriptionStore();

  const cleanupAll = () => {
    if (!socket) return;

    const channels = getSubscribedChannels();
    channels.forEach((channelId) => {
      socket.emit("leave-channel", { channelId });
    });

    clear();
  };

  return { cleanupAll };
}
