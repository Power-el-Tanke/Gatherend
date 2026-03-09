"use client";

import { ChannelView } from "@/components/app-shell/views/channel-view";
import { useBoardSwitchRouting } from "@/contexts/board-switch-context";

/**
 * Room Page - Client Component
 *
 * Wrapper simple que renderiza ChannelView.
 * La auth ya fue validada en el layout de (main).
 * ChannelView obtiene datos via React Query.
 *
 * Nota: La URL usa "rooms" pero internamente el código usa "channel"
 * para mantener consistencia con la base de datos.
 *
 * NOTA: En la arquitectura SPA, esta página es renderizada dentro del
 * CenterContentRouter. El contexto ya tiene los valores correctos.
 */
export default function RoomIdPage() {
  const { currentBoardId, currentChannelId } = useBoardSwitchRouting();

  // El contexto siempre tiene valores porque el layout lo inicializa
  if (!currentChannelId) return null;

  return <ChannelView channelId={currentChannelId} boardId={currentBoardId} />;
}
