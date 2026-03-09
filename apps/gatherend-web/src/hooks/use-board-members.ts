"use client";

import { useCurrentBoardData } from "@/hooks/use-board-data";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import type { BoardMember } from "@/components/providers/board-provider";

/**
 * Hook para obtener los miembros del board actual desde React Query cache
 * Actualizado para SPA: usa useCurrentBoardData en lugar de useBoardContext
 */
export const useBoardMembers = () => {
  const { data: board } = useCurrentBoardData();
  const profile = useProfile();

  const boardId = board?.id || "";
  const profileId = profile?.id || "";

  // Filtrar el usuario actual de la lista de miembros para menciones
  const members: BoardMember[] =
    board?.members?.filter((member) => member.profileId !== profileId) || [];

  return {
    members,
    boardId,
    currentProfileId: profileId,
  };
};
