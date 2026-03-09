"use client";

import { BoardHeader } from "@/components/board/header/board-header";

/**
 * Cliente del header del board.
 *
 * OPTIMIZADO: BoardHeader es completamente estático (BoardDiscovery,
 * AppSettings, CustomUserButton, ModerationButton). No usa datos del board,
 * así que no necesita hooks de navegación ni verificación de skeleton.
 *
 * Esto elimina re-renders innecesarios cuando cambia el board/channel.
 */
export function BoardHeaderClient() {
  return <BoardHeader />;
}
