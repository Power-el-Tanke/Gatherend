"use client";

import { useEffect } from "react";
import { useSocketClient } from "@/components/providers/socket-provider";
import { useMentionStore } from "./use-mention-store";

interface MentionNotification {
  messageId: string;
  channelId: string;
  boardId: string;
  sender: {
    id: string;
    username: string;
    imageUrl: string;
  };
  content: string;
}

interface UseMentionNotificationsProps {
  profileId: string;
  onMention?: (notification: MentionNotification) => void;
}

/**
 * Hook para escuchar notificaciones de menciones en tiempo real
 */
export const useMentionNotifications = ({
  profileId,
  onMention,
}: UseMentionNotificationsProps) => {
  const { socket } = useSocketClient();
  const { addMention } = useMentionStore();

  useEffect(() => {
    if (!socket || !profileId) return;

    const eventKey = `mention:${profileId}`;

    const handleMention = (notification: MentionNotification) => {

      // Añadir la mención al store para mostrar el indicador @
      addMention(notification.channelId);

      // Mostrar notificación del navegador si está permitido
      if (Notification.permission === "granted") {
        new Notification(`${notification.sender.username} mentioned you`, {
          body: notification.content,
          icon: notification.sender.imageUrl || "/default-avatar.png",
        });
      }

      // Callback personalizado
      onMention?.(notification);
    };

    socket.on(eventKey, handleMention);

    return () => {
      socket.off(eventKey, handleMention);
    };
  }, [socket, profileId, onMention, addMention]);
};

