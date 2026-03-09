import { useSocket } from "@/components/providers/socket-provider";
import { useEffect, useMemo, useCallback, useRef } from "react";
import { usePresenceStore } from "./use-presence-store";
import { logger } from "@/lib/logger";

interface PresenceEvent {
  profileId: string;
  timestamp: string;
}

/**
 * Hook que se suscribe a eventos de presencia (online/offline) via sockets
 * y mantiene el estado actualizado en el store
 */
export const usePresence = (profileIds: string[]) => {
  const { socket } = useSocket();

  // Select stable actions/selectors to avoid re-rendering this hook on store updates.
  const setUserOnline = usePresenceStore(
    useCallback((state) => state.setUserOnline, []),
  );
  const setUserOffline = usePresenceStore(
    useCallback((state) => state.setUserOffline, []),
  );
  const mergePresence = usePresenceStore(
    useCallback((state) => state.mergePresence, []),
  );
  const isOnline = usePresenceStore(useCallback((state) => state.isOnline, []));

  // Crear una clave estable para las dependencias
  const profileIdsKey = useMemo(
    () => profileIds.sort().join(","),
    [profileIds]
  );

  // Ref para trackear si ya se hizo el fetch inicial
  const hasFetchedRef = useRef(false);
  // Ref para trackear el último profileIdsKey para el que se hizo fetch
  const lastFetchKeyRef = useRef<string>("");

  // Función de fetch extraída para poder reutilizarla
  const fetchPresence = useCallback(async () => {
    if (profileIds.length === 0) return;

    try {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
      const response = await fetch(`${socketUrl}/presence/check`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileIds }),
      });

      if (response.ok) {
        const data = await response.json();
        // Usar mergePresence en lugar de setPresence para no sobrescribir otros usuarios
        mergePresence(data.presence);
      }
    } catch (error) {
      logger.error("Error fetching presence:", error);
    }
  }, [profileIds, mergePresence]);

  // Effect para fetch inicial y cuando cambian los profileIds
  useEffect(() => {
    if (!socket || profileIds.length === 0) return;

    // Solo hacer fetch si:
    // 1. Es el primer fetch, o
    // 2. Los profileIds han cambiado
    if (!hasFetchedRef.current || lastFetchKeyRef.current !== profileIdsKey) {
      fetchPresence();
      hasFetchedRef.current = true;
      lastFetchKeyRef.current = profileIdsKey;
    }
  }, [socket, profileIdsKey, profileIds.length, fetchPresence]);

  // Effect separado para manejar reconexiones del socket
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      // Forzar refetch después de reconexión
      fetchPresence();
    };

    socket.on("reconnect", handleReconnect);
    // También escuchar el evento connect por si es una nueva conexión
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("reconnect", handleReconnect);
      socket.off("connect", handleReconnect);
    };
  }, [socket, fetchPresence]);

  // Effect para suscribirse a eventos de presencia en tiempo real
  useEffect(() => {
    if (!socket) return;

    // Suscribirse a eventos de presencia
    const handleUserOnline = (event: PresenceEvent) => {
      setUserOnline(event.profileId);
    };

    const handleUserOffline = (event: PresenceEvent) => {
      setUserOffline(event.profileId);
    };

    socket.on("presence:user-online", handleUserOnline);
    socket.on("presence:user-offline", handleUserOffline);

    // Cleanup
    return () => {
      socket.off("presence:user-online", handleUserOnline);
      socket.off("presence:user-offline", handleUserOffline);
    };
  }, [socket, setUserOnline, setUserOffline]);

  // Retornar función helper para verificar si un usuario está online
  return { isOnline, refetch: fetchPresence };
};
