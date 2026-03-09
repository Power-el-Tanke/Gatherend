export interface ClientToServerEvents {
  "join-channel": (data: { channelId: string }) => void;
  "leave-channel": (data: { channelId: string }) => void;
  "typing-start": (data: { channelId: string }) => void;
  "typing-stop": (data: { channelId: string }) => void;
  "typing-start-conversation": (data: { conversationId: string }) => void;
  "typing-stop-conversation": (data: { conversationId: string }) => void;
}

export interface ServerToClientEvents {
  "user-typing": (data: {
    userId: string;
    username: string;
    channelId: string;
  }) => void;
  "user-stopped-typing": (data: { userId: string; channelId: string }) => void;
  "user-typing-conversation": (data: {
    userId: string;
    username: string;
    conversationId: string;
  }) => void;
  "user-stopped-typing-conversation": (data: {
    userId: string;
    conversationId: string;
  }) => void;
  // Los mensajes llegarán con el channelKey dinámico
  // Ejemplo: "chat:123:messages"
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId?: string;
  username?: string;
}
