import { useEffect } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useChannelSubscriptionStore } from "./use-channel-subscription-store";
import { useQueryClient } from "@tanstack/react-query";

// Global map to track pending optimistic message timeouts.
// Socket/global listeners clear these when a confirmed message arrives.
const optimisticTimeouts = new Map<string, NodeJS.Timeout>();

export const clearOptimisticTimeout = (tempId: string) => {
  const timeout = optimisticTimeouts.get(tempId);
  if (timeout) {
    clearTimeout(timeout);
    optimisticTimeouts.delete(tempId);
  }
};

export const setOptimisticTimeout = (tempId: string, timeout: NodeJS.Timeout) => {
  optimisticTimeouts.set(tempId, timeout);
};

interface ChatSocketProps {
  // Kept for compatibility with existing callers (ChatMessages)
  addKey: string;
  updateKey: string;
  queryKey: string[];

  roomId: string;
  roomType: "channel" | "conversation";
  currentProfileId: string;
  currentRoomId: string;
  onNewMessageWhileHistorical?: () => void;
  isInHistoricalMode?: boolean;
}

/**
 * Channel join hook.
 *
 * Conversations are handled by:
 * - `useGlobalConversationListeners` (listeners + join on subscribe/connect)
 * - `useConversationSubscriptionSync` (leave on query removal)
 */
export const useChatSocket = ({ roomId, roomType }: ChatSocketProps) => {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();
  const subscribeChannel = useChannelSubscriptionStore((s) => s.subscribe);

  useEffect(() => {
    if (!socket) return;
    if (roomType !== "channel") return;

    const joinChannelRoom = () => {
      socket.emit("join-channel", { channelId: roomId });
      const { overflow } = subscribeChannel(roomId);

      // Ensure lifecycle flag exists so gcTime / removeQueries can drive leave-channel.
      queryClient.setQueryData(["chat", "channel", roomId], (prev) => {
        const base =
          prev && typeof prev === "object" ? (prev as Record<string, unknown>) : {};
        return { ...base, __lifecycle: true, touchedAt: Date.now() };
      });

      // Enforce N max by removing overflow chat flags (sync hook will leave rooms).
      Array.from(new Set(overflow)).forEach((channelId) => {
        queryClient.removeQueries({
          queryKey: ["chat", "channel", channelId],
          exact: true,
        });
      });
    };

    joinChannelRoom();

    const handleReconnect = () => {
      joinChannelRoom();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      joinChannelRoom();
    };

    socket.on("connect", handleReconnect);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      socket.off("connect", handleReconnect);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [socket, roomId, roomType, subscribeChannel, queryClient]);
};
