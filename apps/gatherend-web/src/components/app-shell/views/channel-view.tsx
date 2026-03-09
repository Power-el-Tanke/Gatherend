"use client";

import { useMemo } from "react";
import { ChannelType } from "@prisma/client";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ConditionalMediaRoom } from "@/components/conditional-media-room";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useAutoMarkAsRead } from "@/hooks/use-auto-mark-as-read";
import {
  useCurrentBoardData,
  useBoardChannelsMap,
  useBoardMembersMap,
} from "@/hooks/use-board-data";

interface ChannelViewProps {
  /** ID del canal (desde CenterContentRouter via BoardSwitchContext) */
  channelId: string;
  /** ID del board (desde CenterContentRouter via BoardSwitchContext) */
  boardId: string;
}

/**
 * ChannelView - Vista del canal de chat
 *
 * Componente cliente que renderiza el chat de un canal.
 * Obtiene datos via React Query y hooks de contexto.
 */
export function ChannelView({ channelId, boardId }: ChannelViewProps) {
  const profile = useProfile();

  // Auto-marcar canal como leido cuando el usuario entra
  useAutoMarkAsRead(channelId, false);

  // Unica suscripcion al query de board en este arbol
  const { data: board, isLoading: boardLoading } = useCurrentBoardData();

  // Derivados a partir del board ya resuelto (sin nuevas lecturas de query)
  const channelsMap = useBoardChannelsMap(board);
  const membersMap = useBoardMembersMap(board);

  const channel = channelsMap.get(channelId);
  const member = useMemo(() => membersMap.get(profile.id), [membersMap, profile.id]);

  const isStaleBoard = Boolean(board && board.id !== boardId);

  // Props estables para hijos memoizados
  const resolvedChannelId = channel?.id ?? "";
  const resolvedBoardId = board?.id ?? "";

  const socketQuery = useMemo(
    () => ({
      channelId: resolvedChannelId,
      boardId: resolvedBoardId,
    }),
    [resolvedChannelId, resolvedBoardId],
  );

  const inputQuery = useMemo(
    () => ({
      channelId: resolvedChannelId,
      boardId: resolvedBoardId,
    }),
    [resolvedChannelId, resolvedBoardId],
  );

  const chatQueryKey = useMemo(
    () => ["chat", "channel", resolvedChannelId],
    [resolvedChannelId],
  );

  if (boardLoading || !channel || !board || isStaleBoard) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        name={channel.name}
        boardId={channel.boardId}
        type="channel"
        channelType={channel.type}
        channelId={channel.id}
      />
      {(channel.type === ChannelType.TEXT || channel.type === ChannelType.MAIN) && (
        <>
          <ChatMessages
            name={channel.name}
            currentProfile={profile}
            currentMember={member}
            board={board}
            apiUrl={`${process.env.NEXT_PUBLIC_API_URL}/messages`}
            socketQuery={socketQuery}
            paramKey="channelId"
            paramValue={channel.id}
            type="channel"
          />
          <ChatInput
            name={channel.name}
            type="channel"
            apiUrl={`${process.env.NEXT_PUBLIC_API_URL}/messages`}
            currentProfile={profile}
            query={inputQuery}
            chatQueryKey={chatQueryKey}
            roomId={channel.id}
          />
        </>
      )}
      <ConditionalMediaRoom
        channelId={channel.id}
        channelName={channel.name}
        channelType={channel.type}
        boardId={board.id}
      />
    </div>
  );
}
