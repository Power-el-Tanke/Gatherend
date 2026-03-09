import { useSocketClient } from "@/components/providers/socket-provider";
import { useEffect, useState, useRef, useCallback } from "react";

interface TypingUser {
  profileId: string;
  username: string;
}

interface UseTypingIndicatorProps {
  roomId: string; // channelId or conversationId
  roomType: "channel" | "conversation";
  currentProfileId: string;
  onTypingChange?: (isTyping: boolean) => void;
}

export const useTypingIndicator = ({
  roomId,
  roomType,
  currentProfileId,
  onTypingChange,
}: UseTypingIndicatorProps) => {
  const { socket } = useSocketClient();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const socketRef = useRef(socket);
  const roomIdRef = useRef(roomId);
  const roomTypeRef = useRef(roomType);
  const onTypingChangeRef = useRef(onTypingChange);
  const prevCauseRef = useRef<{
    socketId: string | null;
    roomId: string;
    roomType: "channel" | "conversation";
    typingUsersCount: number;
    typingText: string;
  } | null>(null);

  // Cleanup typing users after 3 seconds of inactivity
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    socketRef.current = socket;
    roomIdRef.current = roomId;
    roomTypeRef.current = roomType;
    onTypingChangeRef.current = onTypingChange;
  }, [socket, roomId, roomType, onTypingChange]);

  const stopTyping = useCallback(() => {
    if (!isTypingRef.current) return;

    const activeSocket = socketRef.current;
    const activeRoomType = roomTypeRef.current;
    const activeRoomId = roomIdRef.current;

    const event =
      activeRoomType === "channel" ? "typing-stop" : "typing-stop-conversation";
    const payload =
      activeRoomType === "channel"
        ? { channelId: activeRoomId }
        : { conversationId: activeRoomId };

    if (activeSocket) {
      activeSocket.emit(event, payload);
    }
    isTypingRef.current = false;

    onTypingChangeRef.current?.(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const startTyping = useCallback(() => {
    const activeSocket = socketRef.current;
    const activeRoomType = roomTypeRef.current;
    const activeRoomId = roomIdRef.current;

    if (!activeSocket) return;

    const event =
      activeRoomType === "channel"
        ? "typing-start"
        : "typing-start-conversation";
    const payload =
      activeRoomType === "channel"
        ? { channelId: activeRoomId }
        : { conversationId: activeRoomId };

    if (!isTypingRef.current) {
      activeSocket.emit(event, payload);
      isTypingRef.current = true;
      onTypingChangeRef.current?.(true);
    }

    // Auto-stop after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [stopTyping]);

  useEffect(() => {
    if (!socket) return;

    const userTypingEvent =
      roomType === "channel" ? "user-typing" : "user-typing-conversation";
    const userStoppedTypingEvent =
      roomType === "channel"
        ? "user-stopped-typing"
        : "user-stopped-typing-conversation";

    const timers = typingTimers.current;

    const handleUserTyping = (data: {
      profileId: string;
      username: string;
      channelId?: string;
      conversationId?: string;
    }) => {
      const targetRoomId =
        roomType === "channel" ? data.channelId : data.conversationId;

      if (targetRoomId !== roomId || data.profileId === currentProfileId) {
        return;
      }

      // Clear existing timer for this user
      const existingTimer = timers.get(data.profileId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Add or update user
      setTypingUsers((prev) => {
        const exists = prev.some((u) => u.profileId === data.profileId);
        if (exists) return prev;
        return [
          ...prev,
          { profileId: data.profileId, username: data.username },
        ];
      });

      // Set auto-remove timer (3 seconds)
      const timer = setTimeout(() => {
        setTypingUsers((prev) =>
          prev.filter((u) => u.profileId !== data.profileId),
        );
        timers.delete(data.profileId);
      }, 3000);

      timers.set(data.profileId, timer);
    };

    const handleUserStoppedTyping = (data: {
      profileId: string;
      channelId?: string;
      conversationId?: string;
    }) => {
      const targetRoomId =
        roomType === "channel" ? data.channelId : data.conversationId;

      if (targetRoomId !== roomId) {
        return;
      }

      // Clear timer
      const timer = timers.get(data.profileId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(data.profileId);
      }

      // Remove user immediately
      setTypingUsers((prev) =>
        prev.filter((u) => u.profileId !== data.profileId),
      );
    };

    socket.on(userTypingEvent, handleUserTyping);
    socket.on(userStoppedTypingEvent, handleUserStoppedTyping);

    return () => {
      socket.off(userTypingEvent, handleUserTyping);
      socket.off(userStoppedTypingEvent, handleUserStoppedTyping);

      // Clear all timers
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [socket, roomId, roomType, currentProfileId]);

  // Format typing text
  const typingText = (() => {
    const count = typingUsers.length;
    if (count === 0) return "";
    if (count === 1) return `${typingUsers[0].username} is typing...`;
    if (count === 2)
      return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
    if (count === 3)
      return `${typingUsers[0].username}, ${typingUsers[1].username} and ${typingUsers[2].username} are typing...`;
    return `${typingUsers[0].username}, ${typingUsers[1].username}, ${
      typingUsers[2].username
    } and ${count - 3} others are typing...`;
  })();

  useEffect(() => {
    const socketId = socket?.id ?? null;
    const prev = prevCauseRef.current;
    const changed: string[] = [];

    if (!prev || prev.socketId !== socketId) changed.push("socketId");
    if (!prev || prev.roomId !== roomId) changed.push("roomId");
    if (!prev || prev.roomType !== roomType) changed.push("roomType");
    if (!prev || prev.typingUsersCount !== typingUsers.length)
      changed.push("typingUsersCount");
    if (!prev || prev.typingText !== typingText) changed.push("typingText");

    if (changed.length > 0) {
    }

    prevCauseRef.current = {
      socketId,
      roomId,
      roomType,
      typingUsersCount: typingUsers.length,
      typingText,
    };
  }, [roomId, roomType, socket?.id, typingText, typingUsers.length]);

  return {
    typingUsers,
    typingText,
    isTyping: typingUsers.length > 0,
    startTyping,
    stopTyping,
  };
};

