"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "@/components/providers/socket-provider";

/**
 * Hook que se suscribe a un room de discovery para una community específica
 * y escucha eventos de creación o bump de boards.
 *
 * Uso:
 * - Al entrar a la vista de boards de una community, llamar con el communityId
 * - El hook se suscribe al room `discovery:community:{communityId}`
 * - Cuando hay nuevos boards, `hasNewBoards` se vuelve true
 * - Al hacer refresh, llamar `clearIndicator()` para resetear
 * - Al desmontar el componente, se desuscribe automáticamente
 */
export function useNewBoardsIndicator(communityId: string | null) {
  const { socket, isConnected } = useSocket();
  const [hasNewBoards, setHasNewBoards] = useState(false);
  const subscribedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected || !communityId) {
      return;
    }

    const roomName = `discovery:community:${communityId}`;

    // Suscribirse al room
    socket.emit("discovery:subscribe", { communityId });
    subscribedRoomRef.current = roomName;

    // Escuchar eventos de nuevo contenido
    const handleNewBoard = (data: { communityId: string }) => {
      // Solo marcar si es para la community que estamos viendo
      if (data.communityId === communityId) {
        setHasNewBoards(true);
      }
    };

    const handleBoardBump = (data: { communityId: string }) => {
      if (data.communityId === communityId) {
        setHasNewBoards(true);
      }
    };

    socket.on("discovery:board-created", handleNewBoard);
    socket.on("discovery:board-bumped", handleBoardBump);

    // Cleanup: desuscribirse al desmontar o cambiar de community
    return () => {
      socket.off("discovery:board-created", handleNewBoard);
      socket.off("discovery:board-bumped", handleBoardBump);

      if (subscribedRoomRef.current) {
        socket.emit("discovery:unsubscribe", { communityId });
        subscribedRoomRef.current = null;
      }
    };
  }, [socket, isConnected, communityId]);

  // Resetear indicador cuando el usuario hace refresh
  const clearIndicator = useCallback(() => {
    setHasNewBoards(false);
  }, []);

  return {
    hasNewBoards,
    clearIndicator,
  };
}
