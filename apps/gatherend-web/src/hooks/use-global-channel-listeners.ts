import { useEffect, useRef } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useChannelSubscriptionStore } from "./use-channel-subscription-store";
import { Member, Message, Profile } from "@prisma/client";
import { MESSAGES_PER_PAGE } from "./chat/types";
import { useUnreadStore } from "./use-unread-store";
import type { ChatMessage } from "@/hooks/chat/types";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";
import { clearOptimisticTimeout } from "./use-chat-socket";

const MAX_ITEMS_PER_PAGE = MESSAGES_PER_PAGE;

/**
 * Hook global que mantiene listeners de socket activos para TODOS los canales suscritos.
 *
 * Problema que resuelve:
 * - useChatSocket se desmonta cuando el usuario navega a otro canal
 * - Esto removía los listeners aunque el socket seguía en el room
 * - Los mensajes llegaban pero nadie los procesaba
 *
 * Solución:
 * - Este hook vive a nivel global (en GlobalUnreadProvider)
 * - Mantiene UN listener por evento que procesa mensajes de TODOS los canales suscritos
 * - Los mensajes actualizan el cache de React Query directamente
 */

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
  channelId?: string;
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

interface UseGlobalChannelListenersProps {
  currentProfileId: string;
}

export function useGlobalChannelListeners({
  currentProfileId,
}: UseGlobalChannelListenersProps) {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();
  const getSubscribedChannels = useChannelSubscriptionStore(
    (state) => state.getSubscribedChannels,
  );

  // Track previous values for debugging
  const prevSocketRef = useRef<typeof socket>(null);
  const prevProfileIdRef = useRef<string | null>(null);

  // Log when dependencies change
  useEffect(() => {
    const changes: string[] = [];
    if (prevSocketRef.current !== socket) {
      changes.push(`socket: ${prevSocketRef.current?.id ?? 'null'} → ${socket?.id ?? 'null'}`);
    }
    if (prevProfileIdRef.current !== currentProfileId) {
      changes.push(`profileId: ${prevProfileIdRef.current} → ${currentProfileId}`);
    }
    if (changes.length > 0) {
    }
    prevSocketRef.current = socket;
    prevProfileIdRef.current = currentProfileId;
  }, [socket, currentProfileId]);

  // Use ref to always have latest subscribed channels without re-subscribing listeners
  const subscribedChannelsRef = useRef<string[]>([]);

  // Keep ref updated
  useEffect(() => {
    subscribedChannelsRef.current = getSubscribedChannels();
  }, [getSubscribedChannels]);

    // Actualizar ref cada vez que cambie el store
    useEffect(() => {
      const unsubscribe = useChannelSubscriptionStore.subscribe((state) => {
        subscribedChannelsRef.current = Array.from(state.subscribedChannels);
      });
      return unsubscribe;
    }, []);

  useEffect(() => {
    if (!socket) return;


    // Handler genérico que procesa mensajes de cualquier canal suscrito
    const handleChannelMessage = (
      channelId: string,
      message: MessagePayload,
    ) => {
      // Verificar que estamos suscritos a este canal
      if (!subscribedChannelsRef.current.includes(channelId)) {
        return;
      }

      const key = ["chat", "channel", channelId];
      const windowKey = `chatWindow:channel:${channelId}`;

      if (message.tempId) {
        clearOptimisticTimeout(message.tempId);
      }

      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          if (!oldData || !oldData.pages || oldData.pages.length === 0) {
            const { tempId: _, isOptimistic: __, ...cleanMessage } = message;
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

          const pages = [...oldData.pages];
          const firstPage = pages[0];

          if (!firstPage || !Array.isArray(firstPage.items)) {
            return oldData;
          }

          // Check for optimistic message replacement by tempId
          if (message.tempId) {
            for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
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
                const {
                  tempId: _,
                  isOptimistic: __,
                  ...cleanMessage
                } = message;
                updatedItems[optimisticIndex] =
                  cleanMessage as MessageWithMemberWithProfile;
                pages[pageIndex] = { ...page, items: updatedItems };
                return { ...oldData, pages };
              }
            }
          }

          // Check for duplicates
          const messageAlreadyExists = pages.some(
            (page) =>
              page &&
              Array.isArray(page.items) &&
              page.items.some(
                (m: MessageWithMemberWithProfile) => m.id === message.id,
              ),
          );

          if (messageAlreadyExists) {
            return oldData;
          }

          const { tempId: _, isOptimistic: __, ...cleanMessage } = message;
          const newItems = [
            cleanMessage as MessageWithMemberWithProfile,
            ...firstPage.items,
          ];

          // Truncate if needed
          if (newItems.length > MAX_ITEMS_PER_PAGE) {
            const truncatedItems = newItems.slice(0, MAX_ITEMS_PER_PAGE);
            const lastKeptItem = truncatedItems[truncatedItems.length - 1];
            pages[0] = {
              ...firstPage,
              items: truncatedItems,
              nextCursor: lastKeptItem?.id || firstPage.nextCursor,
            };
            return { ...oldData, pages };
          }

          pages[0] = { ...firstPage, items: newItems };
          return { ...oldData, pages };
        },
      );

      // Sync message-window store used by ChatMessages.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tempId: _, isOptimistic: __, ...cleanMessage } = message;
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

      // Mark unread for subscribed channels when user is not actively viewing
      // this room. This keeps badges reliable even if board-level global events
      // are temporarily out of sync.
      const unreadState = useUnreadStore.getState();
      const messageSender = message.member?.profile || message.sender || null;
      const isOwnMessage = messageSender?.id === currentProfileId;
      const isViewingThisRoom = unreadState.viewingRoom === channelId;

      if (!isOwnMessage && !isViewingThisRoom) {
        unreadState.addUnread(channelId);
      }
    };

    // Handler para updates (edit/delete)
    const handleChannelUpdate = (
      channelId: string,
      message: MessageWithMemberWithProfile,
    ) => {
      if (!subscribedChannelsRef.current.includes(channelId)) {
        return;
      }

      const key = ["chat", "channel", channelId];
      const windowKey = `chatWindow:channel:${channelId}`;

      queryClient.setQueryData(
        key,
        (oldData: PaginatedMessageData | undefined) => {
          if (!oldData || !oldData.pages) return oldData;

          if (message.deleted) {
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

    // Listener genérico que extrae channelId del evento
    // El servidor envía a `chat:${channelId}:messages`
    // Necesitamos escuchar todos los canales dinámicamente

    // Crear listeners dinámicos basados en canales suscritos
    const setupListenersForChannel = (channelId: string) => {
      const addKey = `chat:${channelId}:messages`;
      const updateKey = `chat:${channelId}:messages:update`;


      const onMessage = (message: MessagePayload) => {
        handleChannelMessage(channelId, message);
      };

      const onUpdate = (message: MessageWithMemberWithProfile) => {
        handleChannelUpdate(channelId, message);
      };

      socket.on(addKey, onMessage);
      socket.on(updateKey, onUpdate);

      return () => {
        socket.off(addKey, onMessage);
        socket.off(updateKey, onUpdate);
      };
    };

    // Map para trackear cleanups por canal
    const channelCleanups = new Map<string, () => void>();

    // Suscribirse a cambios del store para agregar/remover listeners dinámicamente
    const unsubscribeStore = useChannelSubscriptionStore.subscribe(
      (state, prevState) => {
        const currentChannels = state.subscribedChannels;
        const prevChannels = prevState.subscribedChannels;

        // Agregar listeners para nuevos canales
        currentChannels.forEach((channelId) => {
          if (!prevChannels.has(channelId) && !channelCleanups.has(channelId)) {
            const cleanup = setupListenersForChannel(channelId);
            channelCleanups.set(channelId, cleanup);
          }
        });

        // Remover listeners para canales que ya no están suscritos
        prevChannels.forEach((channelId) => {
          if (!currentChannels.has(channelId)) {
            const cleanup = channelCleanups.get(channelId);
            if (cleanup) {
              cleanup();
              channelCleanups.delete(channelId);
            }
          }
        });
      },
    );

    // Setup inicial para canales ya suscritos
    subscribedChannelsRef.current.forEach((channelId) => {
      if (!channelCleanups.has(channelId)) {
        const cleanup = setupListenersForChannel(channelId);
        channelCleanups.set(channelId, cleanup);
      }
    });

    // Function to join all subscribed channels on server
    const joinAllSubscribedChannels = () => {
      subscribedChannelsRef.current.forEach((channelId) => {
        socket.emit("join-channel", { channelId });
      });
    };

    const markAllSubscribedNeedsCatchUp = () => {
      subscribedChannelsRef.current.forEach((channelId) => {
        chatMessageWindowStore.markNeedsCatchUpIfExists(
          `chatWindow:channel:${channelId}`,
        );
      });
    };

    // CRITICAL: If socket is already connected, join channels immediately
    // This handles the case where useEffect runs AFTER socket.connect() has already fired
    if (socket.connected) {
      joinAllSubscribedChannels();
      // Do NOT catch-up here: this effect can remount during SPA navigation even when the socket
      // never disconnected. Invalidating here would refetch messages and churn signed attachment URLs,
      // causing unnecessary image re-downloads.
    }

    // Listen for future reconnections
    const handleReconnect = () => {
      joinAllSubscribedChannels();
      markAllSubscribedNeedsCatchUp();
    };
    socket.on("connect", handleReconnect);

    const handleDisconnect = () => {
      markAllSubscribedNeedsCatchUp();
    };
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleReconnect);
      socket.off("disconnect", handleDisconnect);
      unsubscribeStore();
      channelCleanups.forEach((cleanup) => cleanup());
      channelCleanups.clear();
    };
  }, [socket, queryClient, currentProfileId]);
}
