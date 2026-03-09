"use client";

import { memo } from "react";
import { LeftbarSkeleton } from "@/components/board/board-skeletons";
import { BoardLeftbar } from "@/components/board/leftbar/board-leftbar";
import { cn } from "@/lib/utils";
import { useBoardDataWithStaleness } from "@/hooks/use-board-data-with-staleness";
import { useCurrentMemberRole } from "@/hooks/use-board-data";
import { useProfile } from "@/components/app-shell/providers/profile-provider";

/**
 * Versión cliente del BoardLeftbar que reacciona a cambios de board.
 * Usa el hook centralizado useBoardDataWithStaleness para detección de datos stale.
 *
 * OPTIMIZACIÓN: Usa useProfile() en lugar de recibir currentProfileId como prop,
 * eliminando el props drilling desde el layout.
 */
function BoardLeftbarClientInner() {
  // Obtener profile del contexto en lugar de props
  const profile = useProfile();

  // Hook centralizado para board data con detección de staleness
  const { board, isFetching, showSkeleton } = useBoardDataWithStaleness();

  // OPTIMIZACIÓN: Usar hook centralizado con Map para lookup O(1)
  const currentMemberRole = useCurrentMemberRole(profile.id);

  if (showSkeleton || !board) {
    return <LeftbarSkeleton />;
  }

  return (
    <div
      className={cn("h-full", isFetching && "opacity-90 transition-opacity")}
    >
      <BoardLeftbar
        board={board}
        role={currentMemberRole}
        currentProfileId={profile.id}
      />
    </div>
  );
}

// Memoizar el componente para evitar re-renders innecesarios
export const BoardLeftbarClient = memo(BoardLeftbarClientInner);
