import { Server, Socket } from "socket.io";

export const registerDirectMessageSocket = (io: Server) => {
  // NOTA: Los handlers de join-conversation y leave-conversation
  // ya están manejados en server.ts para evitar duplicación.
  // Este módulo queda preparado para handlers específicos de DM en el futuro.
};
