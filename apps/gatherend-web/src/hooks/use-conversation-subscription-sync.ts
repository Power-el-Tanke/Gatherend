import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketClient } from "@/components/providers/socket-provider";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { useConversationSubscriptionStore } from "./use-conversation-subscription-store";

/**
 * Sincroniza `leave-conversation` con el lifecycle de React Query para
 * `["chat","conversation",conversationId]`.
 *
 * - La "suscripción" se mantiene mientras exista la query en cache.
 * - Cuando la query es removida (gcTime o removeQueries por LRU),
 *   este hook hace leave-conversation y limpia store + window.
 */
export function useConversationSubscriptionSync() {
  const queryClient = useQueryClient();
  const { socket } = useSocketClient();
  const pendingLeavesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    if (!socket) return;

    const queryCache = queryClient.getQueryCache();
    const pendingLeaves = pendingLeavesRef.current;

    const isConversationChatKey = (queryKey: readonly unknown[]) => {
      return (
        queryKey[0] === "chat" &&
        queryKey[1] === "conversation" &&
        typeof queryKey[2] === "string" &&
        queryKey[2].length > 0
      );
    };

    const cancelPendingLeave = (conversationId: string) => {
      const timer = pendingLeaves.get(conversationId);
      if (timer) {
        clearTimeout(timer);
        pendingLeaves.delete(conversationId);
      }
    };

    const scheduleLeave = (conversationId: string) => {
      if (
        !useConversationSubscriptionStore.getState().isSubscribed(conversationId)
      ) {
        return;
      }

      cancelPendingLeave(conversationId);

      const timer = setTimeout(() => {
        const stillExists = queryCache.find({
          queryKey: ["chat", "conversation", conversationId],
          exact: true,
        });
        if (stillExists) {
          pendingLeaves.delete(conversationId);
          return;
        }

        const store = useConversationSubscriptionStore.getState();
        if (!store.isSubscribed(conversationId)) {
          pendingLeaves.delete(conversationId);
          return;
        }

        if (socket.connected) {
          socket.emit("leave-conversation", { conversationId });
        } else {
        }

        store.unsubscribe(conversationId);
        chatMessageWindowStore.deleteIfUnused(
          `chatWindow:conversation:${conversationId}`,
        );
        pendingLeaves.delete(conversationId);
      }, 1200);

      pendingLeaves.set(conversationId, timer);
    };

    const unsubscribeFromCache = queryCache.subscribe((event) => {
      const queryKey = event.query.queryKey;
      if (!isConversationChatKey(queryKey)) return;
      const conversationId = queryKey[2] as string;

      if (event.type === "added" || event.type === "updated") {
        cancelPendingLeave(conversationId);
        return;
      }

      if (event.type === "removed") {
        scheduleLeave(conversationId);
      }
    });

    return () => {
      pendingLeaves.forEach((timer) => clearTimeout(timer));
      pendingLeaves.clear();
      unsubscribeFromCache();
    };
  }, [socket, queryClient]);
}

