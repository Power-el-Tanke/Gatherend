"use client";

import { ConversationView } from "@/components/app-shell/views/conversation-view";
import { useBoardSwitchRouting } from "@/contexts/board-switch-context";

/**
 * Conversation Page - Client Component
 *
 * Wrapper simple que renderiza ConversationView.
 * La auth ya fue validada en el layout de (main).
 * ConversationView obtiene datos via React Query.
 *
 * NOTA: En la arquitectura SPA, esta página es renderizada dentro del
 * CenterContentRouter. El contexto ya tiene los valores correctos.
 */
export default function ConversationIdPage() {
  const { currentBoardId, currentConversationId } = useBoardSwitchRouting();

  // El contexto siempre tiene valores porque el layout lo inicializa
  if (!currentConversationId) return null;

  return (
    <ConversationView
      conversationId={currentConversationId}
      boardId={currentBoardId}
    />
  );
}
