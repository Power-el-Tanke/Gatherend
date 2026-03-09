import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketClient } from "@/components/providers/socket-provider";
import { logger } from "@/lib/logger";
import { useUnreadStore } from "./use-unread-store";
import { useConversationSubscriptionStore } from "./use-conversation-subscription-store";
import type { ChatMessage } from "@/hooks/chat/types";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { clearOptimisticTimeout } from "./use-chat-socket";
import { Member, Message, Profile } from "@prisma/client";
import { MESSAGES_PER_PAGE } from "./chat/types";

const MAX_ITEMS_PER_PAGE = MESSAGES_PER_PAGE;

type MessageWithMemberWithProfile = Message & {
  member: Member & {
    profile: Profile;
  };
  reactions?: MessageReaction[];
};

interface MessageReaction {
  id: string;
  emoji: string;
  profileId: string;
  messageId: string;
  profile?: Profile;
}

interface MessagePayload {
  id: string;
  content: string;
  fileUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  tempId?: string;
  member?: Member & { profile: Profile };
  sender?: Profile;
  isOptimistic?: boolean;
  deleted?: boolean;
  reactions?: MessageReaction[];
}

interface ReactionPayload {
  messageId: string;
  reaction: MessageReaction;
  action: "add" | "remove";
}

interface PaginatedMessagePage {
  items: MessageWithMemberWithProfile[];
  nextCursor?: string | null;
  previousCursor?: string | null;
}

interface PaginatedMessageData {
  pages: PaginatedMessagePage[];
  pageParams?: unknown[];
}

interface UseGlobalConversationListenersProps {
  currentProfileId: string;
}

/**
 * Hook global que mantiene listeners de socket activos para TODAS las conversaciones (DMs)
 * suscritas en `useConversationSubscriptionStore`.
 *
 * Nota:
 * - La lista de DMs (preview/unread) sigue viniendo por `profile:${profileId}`
 *   via `global:conversation:message` (ver `use-global-unread-socket.ts`).
 * - Este hook solo procesa el "heavy stream" por `conversation:${conversationId}`.
 */
export function useGlobalConversationListeners({
  currentProfileId,
}: UseGlobalConversationListenersProps) {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();
  const addUnread = useUnreadStore((s) => s.addUnread);
  const getSubscribedConversations = useConversationSubscriptionStore(
    (s) => s.getSubscribedConversations,
  );

  const subscribedConversationsRef = useRef<string[]>([]);

  useEffect(() => {
    subscribedConversationsRef.current = getSubscribedConversations();
  }, [getSubscribedConversations]);

  useEffect(() => {
    const unsubscribe = useConversationSubscriptionStore.subscribe((state) => {
      subscribedConversationsRef.current = Array.from(
        state.subscribedConversations,
      );
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleConversationMessage = (
      conversationId: string,
      message: MessagePayload,
    ) => {
      if (!subscribedConversationsRef.current.includes(conversationId)) {
        return;
      }

      const key = ["chat", "conversation", conversationId];
      const windowKey = `chatWindow:conversation:${conversationId}`;

      if (message.tempId) {
        clearOptimisticTimeout(message.tempId);
      }

      // Keep React Query cache (if present) in sync for optimistic flows / retries.
      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          const pages = Array.isArray(oldData?.pages) ? [...oldData.pages] : [];
          const firstPage = pages[0];

          const { tempId: _, isOptimistic: __, ...cleanMessage } = message;

          if (!firstPage || !Array.isArray(firstPage.items)) {
            return {
              pages: [
                {
                  items: [cleanMessage as MessageWithMemberWithProfile],
                  nextCursor: null,
                  previousCursor: null,
                },
              ],
              pageParams: [undefined],
            };
          }

          // Replace optimistic by tempId across all pages.
          if (message.tempId) {
            for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
              const page = pages[pageIndex];
              if (!page || !Array.isArray(page.items)) continue;

              const optimisticIndex = page.items.findIndex(
                (
                  m: MessageWithMemberWithProfile & {
                    isOptimistic?: boolean;
                    tempId?: string;
                  },
                ) => m.isOptimistic && m.tempId === message.tempId,
              );

              if (optimisticIndex !== -1) {
                const updatedItems = [...page.items];
                updatedItems[optimisticIndex] =
                  cleanMessage as MessageWithMemberWithProfile;
                pages[pageIndex] = { ...page, items: updatedItems };
                return { ...oldData, pages };
              }
            }
          }

          // Dedupe.
          const alreadyExists = pages.some(
            (p) =>
              p &&
              Array.isArray(p.items) &&
              p.items.some((m) => m.id === message.id),
          );
          if (alreadyExists) return oldData;

          const newItems = [
            cleanMessage as MessageWithMemberWithProfile,
            ...firstPage.items,
          ];

          if (newItems.length > MAX_ITEMS_PER_PAGE) {
            const truncated = newItems.slice(0, MAX_ITEMS_PER_PAGE);
            const lastKept = truncated[truncated.length - 1];
            pages[0] = {
              ...firstPage,
              items: truncated,
              nextCursor: lastKept?.id || firstPage.nextCursor,
            };
            return { ...oldData, pages };
          }

          pages[0] = { ...firstPage, items: newItems };
          return { ...oldData, pages };
        },
      );

      // Sync message-window store (ChatMessages source-of-truth).
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tempId: ___, isOptimistic: ____, ...cleanMessage } = message;
      const live = chatMessageWindowStore.get(windowKey);
      const preferAfterCache = Boolean(live.hasMoreAfter);
      if (message.tempId) {
        chatMessageWindowStore.replaceOptimisticByTempId(
          windowKey,
          message.tempId,
          cleanMessage as unknown as ChatMessage,
        );
      }
      chatMessageWindowStore.upsertById(
        windowKey,
        cleanMessage as unknown as ChatMessage,
        {
          insertIfMissing: true,
          ...(preferAfterCache ? { preferAfterCache: true } : {}),
        },
      );

      // Unread fallback: if heavy stream arrives and user isn't viewing.
      const unreadState = useUnreadStore.getState();
      const sender = message.member?.profile || message.sender || null;
      const isOwnMessage = sender?.id === currentProfileId;
      const isViewingThisRoom = unreadState.viewingRoom === conversationId;
      if (!isOwnMessage && !isViewingThisRoom) {
        addUnread(conversationId, Date.now());
      }
    };

    const handleConversationUpdate = (
      conversationId: string,
      message: MessageWithMemberWithProfile,
    ) => {
      if (!subscribedConversationsRef.current.includes(conversationId)) {
        return;
      }

      const key = ["chat", "conversation", conversationId];
      const windowKey = `chatWindow:conversation:${conversationId}`;

      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          if (!oldData || !oldData.pages) return oldData;

          if ((message as unknown as { deleted?: boolean }).deleted) {
            const newPages = oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter((m) => m.id !== message.id),
            }));
            return { ...oldData, pages: newPages };
          }

          const newPages = oldData.pages.map((page) => ({
            ...page,
            items: page.items.map((m) => (m.id === message.id ? message : m)),
          }));
          return { ...oldData, pages: newPages };
        },
      );

      if ((message as unknown as { deleted?: boolean }).deleted) {
        chatMessageWindowStore.removeById(windowKey, message.id);
      } else {
        chatMessageWindowStore.upsertById(
          windowKey,
          message as unknown as ChatMessage,
          { insertIfMissing: false },
        );
      }
    };

    const handleConversationReaction = (
      conversationId: string,
      data: ReactionPayload,
    ) => {
      if (!subscribedConversationsRef.current.includes(conversationId)) {
        return;
      }

      const key = ["chat", "conversation", conversationId];
      const windowKey = `chatWindow:conversation:${conversationId}`;

      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          if (!oldData || !oldData.pages) return oldData;

          const pages = oldData.pages.map((page) => {
            if (!page || !Array.isArray(page.items)) return page;
            return {
              ...page,
              items: page.items.map((msg) => {
                if (msg.id !== data.messageId) return msg;
                const currentReactions = msg.reactions || [];
                if (data.action === "add") {
                  if (
                    currentReactions.some((r) => r.id === data.reaction.id)
                  ) {
                    return msg;
                  }
                  return { ...msg, reactions: [...currentReactions, data.reaction] };
                }
                return {
                  ...msg,
                  reactions: currentReactions.filter(
                    (r) => r.id !== data.reaction.id,
                  ),
                };
              }),
            };
          });

          return { ...oldData, pages };
        },
      );

      chatMessageWindowStore.updateById(
        windowKey,
        data.messageId,
        (prev) => {
          const current = (prev as any).reactions as MessageReaction[] | undefined;
          const currentReactions = Array.isArray(current) ? current : [];
          if (data.action === "add") {
            if (currentReactions.some((r) => r.id === data.reaction.id)) {
              return prev;
            }
            return { ...(prev as any), reactions: [...currentReactions, data.reaction] };
          }
          return {
            ...(prev as any),
            reactions: currentReactions.filter((r) => r.id !== data.reaction.id),
          };
        },
      );
    };

    const setupListenersForConversation = (conversationId: string) => {
      const addKey = `chat:${conversationId}:messages`;
      const updateKey = `chat:${conversationId}:messages:update`;
      const reactionKey = `chat:${conversationId}:reactions`;

      const onMessage = (message: MessagePayload) => {
        handleConversationMessage(conversationId, message);
      };
      const onUpdate = (message: MessageWithMemberWithProfile) => {
        handleConversationUpdate(conversationId, message);
      };
      const onReaction = (data: ReactionPayload) => {
        handleConversationReaction(conversationId, data);
      };

      socket.on(addKey, onMessage);
      socket.on(updateKey, onUpdate);
      socket.on(reactionKey, onReaction);

      if (socket.connected) {
        socket.emit("join-conversation", { conversationId });
      }

      return () => {
        socket.off(addKey, onMessage);
        socket.off(updateKey, onUpdate);
        socket.off(reactionKey, onReaction);
      };
    };

    const conversationCleanups = new Map<string, () => void>();

    const unsubscribeStore = useConversationSubscriptionStore.subscribe(
      (state, prevState) => {
        const current = state.subscribedConversations;
        const prev = prevState.subscribedConversations;

        current.forEach((conversationId) => {
          if (!prev.has(conversationId) && !conversationCleanups.has(conversationId)) {
            const cleanup = setupListenersForConversation(conversationId);
            conversationCleanups.set(conversationId, cleanup);
          }
        });

        prev.forEach((conversationId) => {
          if (!current.has(conversationId)) {
            const cleanup = conversationCleanups.get(conversationId);
            if (cleanup) {
              cleanup();
              conversationCleanups.delete(conversationId);
            }
          }
        });
      },
    );

    subscribedConversationsRef.current.forEach((conversationId) => {
      if (!conversationCleanups.has(conversationId)) {
        const cleanup = setupListenersForConversation(conversationId);
        conversationCleanups.set(conversationId, cleanup);
      }
    });

    const joinAllSubscribedConversations = () => {
      subscribedConversationsRef.current.forEach((conversationId) => {
        socket.emit("join-conversation", { conversationId });
      });
    };

    const markAllSubscribedNeedsCatchUp = () => {
      subscribedConversationsRef.current.forEach((conversationId) => {
        chatMessageWindowStore.markNeedsCatchUpIfExists(
          `chatWindow:conversation:${conversationId}`,
        );
      });
    };

    if (socket.connected) {
      joinAllSubscribedConversations();
      // Do not mark catch-up on initial mount; we only do it after a real disconnect/reconnect.
    }

    const handleConnect = () => {
      joinAllSubscribedConversations();
      markAllSubscribedNeedsCatchUp();
    };
    const handleDisconnect = () => {
      markAllSubscribedNeedsCatchUp();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (!socket.connected) return;
      joinAllSubscribedConversations();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      unsubscribeStore();
      conversationCleanups.forEach((cleanup) => cleanup());
      conversationCleanups.clear();
    };
  }, [socket, queryClient, addUnread, currentProfileId]);
}

