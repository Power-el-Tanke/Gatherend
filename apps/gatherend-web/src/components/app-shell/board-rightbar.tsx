"use client";

import { useMemo, memo } from "react";
import { RightbarSkeleton } from "@/components/board/board-skeletons";
import { Separator } from "@/components/ui/separator";
import { SlotGrid } from "@/components/board/rightbar/members-section/member-grid";
import { DirectMessages } from "@/components/board/rightbar/rightbar-direct-messages-list";
import { VoiceControlBar } from "@/components/voice-control-bar";
import {
  useConversations,
  useConversationProfileIds,
} from "@/hooks/use-conversations";
import { usePresence } from "@/hooks/use-presence";
import { useBoardDataWithStaleness } from "@/hooks/use-board-data-with-staleness";
import {
  useBoardMemberIds,
  useBoardSlotProfileIds,
} from "@/hooks/use-board-data";
import { useProfileRoomSubscriptions } from "@/hooks/use-profile-room-subscriptions";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 *
 * BoardRightbarClient - Arquitectura optimizada con secciones independientes
 *
 *
 * PROBLEMA ANTERIOR:
 * Un solo componente con todos los hooks causaba 9+ re-renders al cambiar board
 * porque TODOS los hooks disparaban cuando cualquier dato cambiaba.
 *
 * SOLUCIÓN:
 * Separar en secciones independientes que solo reaccionan a sus propios datos:
 * - MembersSectionClient: reacciona a cambios del board
 * - DirectMessagesSectionClient: independiente del board (memoizado)
 * - PresenceManager: invisible, maneja presencia de forma centralizada
 *
 *
 */

/**
 * Wrapper principal del rightbar - estructura mínima con secciones independientes.
 */
function BoardRightbarClientInner() {
  const profile = useProfile();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Presencia centralizada - invisible, no causa re-renders visuales */}
      <PresenceManager profileId={profile.id} />

      {/* Members Section - reacciona a cambios del board */}
      <MembersSectionClient profileId={profile.id} />

      <Separator className="bg-theme-border-primary rounded-md mt-0 mb-2" />

      {/* Direct Messages - independiente del board, memoizado */}
      <DirectMessagesSectionClient profileId={profile.id} />

      {/* Voice Control Bar - aparece al final cuando hay llamada activa */}
      <VoiceControlBar position="right" />
    </div>
  );
}

/**
 * Componente invisible que maneja presencia para todos los usuarios relevantes.
 * Separado para que sus re-renders no afecten el rendering visual.
 */
const PresenceManager = memo(function PresenceManager({
  profileId,
}: {
  profileId: string;
}) {
  const memberIds = useBoardMemberIds();
  const slotProfileIds = useBoardSlotProfileIds();
  const conversationProfileIds = useConversationProfileIds();

  const allProfileIds = useMemo(() => {
    return [
      ...new Set([
        profileId,
        ...memberIds,
        ...conversationProfileIds,
        ...slotProfileIds,
      ]),
    ];
  }, [profileId, memberIds, conversationProfileIds, slotProfileIds]);

  usePresence(allProfileIds);

  return null; // Invisible
});

/**
 * Sección de miembros - SE RE-RENDERIZA cuando cambia el board.
 * Esto es correcto porque los miembros cambian por board.
 */
const MembersSectionClient = memo(function MembersSectionClient({
  profileId,
}: {
  profileId: string;
}) {
  const { t } = useTranslation();
  const { board, isFetching, showSkeleton } = useBoardDataWithStaleness();
  const profile = useProfile();

  if (showSkeleton || !board) {
    return <MembersSkeleton />;
  }

  return (
    <div className={cn(isFetching && "opacity-90 transition-opacity")}>
      <div className="px-4 pt-3 pb-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary">
          {t.rightbar.members} —{" "}
          {board.slots.filter((s) => s.member !== null).length}/
          {board.slots.length}
        </h2>
      </div>

      <SlotGrid
        slots={board.slots}
        currentProfileId={profileId}
        currentProfile={profile}
      />
    </div>
  );
});

function MembersSkeleton() {
  return (
    <div className="px-4 pt-3 pb-0">
      <div className="h-4 w-24 bg-theme-bg-tertiary rounded animate-pulse mb-3" />
      <div className="relative w-full h-[250px] flex items-center justify-center">
        <div className="grid grid-cols-3 grid-rows-3 gap-3 w-full max-w-[200px]">
          {/* Fila 1: solo círculo central */}
          <div />
          <div className="aspect-square rounded-full bg-theme-bg-tertiary animate-pulse" />
          <div />

          {/* Fila 2: 3 círculos */}
          <div className="aspect-square rounded-full bg-theme-bg-tertiary animate-pulse" />
          <div className="aspect-square rounded-full bg-theme-bg-tertiary animate-pulse" />
          <div className="aspect-square rounded-full bg-theme-bg-tertiary animate-pulse" />

          {/* Fila 3: solo círculo central */}
          <div />
          <div className="aspect-square rounded-full bg-theme-bg-tertiary animate-pulse" />
          <div />
        </div>
      </div>
    </div>
  );
}

/**
 * Sección de DMs - NO SE RE-RENDERIZA cuando cambia el board.
 * Las conversaciones son independientes del board actual.
 */
const DirectMessagesSectionClient = memo(function DirectMessagesSectionClient({
  profileId,
}: {
  profileId: string;
}) {
  const { conversations, isLoading } = useConversations();

  const topDmProfileIds = useMemo(() => {
    const list = conversations || [];
    return list
      .slice(0, 20)
      .map((c) => c.otherProfile?.id)
      .filter((id): id is string => !!id);
  }, [conversations]);

  useProfileRoomSubscriptions(topDmProfileIds);

  if (isLoading) {
    return <DirectMessagesSkeleton />;
  }

  return (
    <DirectMessages
      conversations={conversations || []}
      currentProfileId={profileId}
    />
  );
});

function DirectMessagesSkeleton() {
  return (
    <div className="px-4 pt-2">
      <div className="h-4 w-32 bg-theme-bg-tertiary rounded animate-pulse mb-3" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2">
          <div className="w-8 h-8 rounded-full bg-theme-bg-tertiary animate-pulse" />
          <div className="h-4 w-24 bg-theme-bg-tertiary rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// Memoizar el wrapper principal
export const BoardRightbarClient = memo(BoardRightbarClientInner);
