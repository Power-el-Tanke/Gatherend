"use client";

import { useChannelSubscriptionSync } from "@/hooks/use-channel-subscription-sync";
import { useGlobalChannelListeners } from "@/hooks/use-global-channel-listeners";
import { useConversationSubscriptionSync } from "@/hooks/use-conversation-subscription-sync";
import { useGlobalConversationListeners } from "@/hooks/use-global-conversation-listeners";

/**
 * ChatCacheProvider - Mantiene el caché de canales actualizado via socket
 *
 * Responsabilidades:
 * - useGlobalChannelListeners: mantiene listeners de socket activos para
 *   todos los canales suscritos, actualizando el caché de React Query
 *   aunque el usuario navegue a otro canal
 * - useChannelSubscriptionSync: sincroniza suscripciones de socket con el
 *   ciclo de vida del caché (hace leave-channel cuando gcTime expira)
 */

interface ChatCacheProviderProps {
  currentProfileId: string;
  children: React.ReactNode;
}

export function ChatCacheProvider({
  currentProfileId,
  children,
}: ChatCacheProviderProps) {
  // Mantener listeners de socket activos para todos los canales suscritos
  useGlobalChannelListeners({ currentProfileId });
  useGlobalConversationListeners({ currentProfileId });

  // Sincronizar suscripciones de socket con el caché de React Query
  useChannelSubscriptionSync();
  useConversationSubscriptionSync();

  return <>{children}</>;
}
