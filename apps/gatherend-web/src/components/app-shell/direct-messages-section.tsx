"use client";

import { memo } from "react";
import { DirectMessages } from "@/components/board/rightbar/rightbar-direct-messages-list";
import { FormattedConversation } from "@/hooks/use-conversations";

interface DirectMessagesSectionProps {
  /** Lista de conversaciones del usuario */
  conversations: FormattedConversation[];
  /** Profile ID del usuario actual */
  currentProfileId: string;
}

/**
 * Sección de Direct Messages - Componente presentacional puro.
 *
 * IMPORTANTE: Este componente NO llama a usePresence ni useConversations.
 * - La presencia se maneja de forma centralizada en BoardRightbarClient
 * - Las conversaciones se pasan como prop desde BoardRightbarClient
 *
 * Esto evita:
 * - Duplicación de suscripciones a usePresence
 * - Doble fetching de conversaciones
 * - Re-renders innecesarios
 */
function DirectMessagesSectionInner({
  conversations,
  currentProfileId,
}: DirectMessagesSectionProps) {
  return (
    <DirectMessages
      conversations={conversations}
      currentProfileId={currentProfileId}
    />
  );
}

/**
 * Skeleton para la sección de DMs
 */
export function DirectMessagesSkeleton() {
  return (
    <div className="flex flex-col pr-3 -mt-0.5 space-y-2">
      <div className="flex items-center justify-between pl-3 pr-1">
        <div className="h-3 w-16 bg-theme-bg-tertiary rounded animate-pulse" />
        <div className="h-6 w-6 bg-theme-bg-tertiary rounded-full animate-pulse" />
      </div>
      <div className="flex flex-col pl-1 space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <div className="h-8 w-8 bg-theme-bg-tertiary rounded-full animate-pulse" />
            <div className="h-3 w-24 bg-theme-bg-tertiary rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Memoizar para evitar re-renders cuando las props no cambian
export const DirectMessagesSection = memo(DirectMessagesSectionInner);
