import { Server } from "socket.io";

export function registerMessageSocket(io: Server) {
  // NOTA: El handler 'send-message' fue removido porque el frontend
  // usa HTTP POST directamente (messages.routes.ts) en lugar de WebSocket.
  // Los mensajes se emiten desde el endpoint HTTP después de guardar en DB.
}
