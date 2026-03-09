"use client";

import { BoardView } from "@/components/app-shell/views/board-view";

/**
 * Board Page - Client Component
 *
 * Wrapper simple que renderiza BoardView.
 * La auth ya fue validada en el layout de (main).
 * BoardView maneja el redirect al canal inicial.
 */
export default function BoardIdPage() {
  return <BoardView />;
}
