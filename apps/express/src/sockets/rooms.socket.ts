// Room management socket handlers (channels, boards, conversations)
import { Server, Socket } from "socket.io";
import {
  getChannelByIdCached,
  verifyMemberInBoardCached,
  findConversationForProfileCached,
} from "../lib/cache.js";
import { checkTypingRateLimit } from "../middleware/rate-limit.js";
import { logger } from "../lib/logger.js";

type SocketPayload = Record<string, unknown>;

function isSocketPayload(value: unknown): value is SocketPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getPayloadId(payload: unknown, key: string): string | null {
  if (!isSocketPayload(payload)) return null;
  return getNonEmptyString(payload[key]);
}

function getSocketProfileId(socket: Socket): string | null {
  return getNonEmptyString(socket.data?.profileId);
}

function getSocketUsername(socket: Socket): string {
  return getNonEmptyString(socket.data?.username) ?? "Usuario";
}

/**
 * Register room-related socket event handlers
 */
export function registerRoomHandlers(io: Server, socket: Socket) {
  // TYPING INDICATORS - CHANNELS

  socket.on("typing-start", (payload?: unknown) => {
    try {
      const channelId = getPayloadId(payload, "channelId");
      if (!channelId) return;
      if (!checkTypingRateLimit(socket.id)) {
        return;
      }
      socket.to(`channel:${channelId}`).emit("user-typing", {
        profileId: getSocketProfileId(socket) ?? socket.id,
        username: getSocketUsername(socket),
        channelId,
      });
    } catch (error) {
      logger.error(`Error in typing-start for ${socket.id}:`, error);
    }
  });

  socket.on("typing-stop", (payload?: unknown) => {
    try {
      const channelId = getPayloadId(payload, "channelId");
      if (!channelId) return;
      socket.to(`channel:${channelId}`).emit("user-stopped-typing", {
        profileId: getSocketProfileId(socket) ?? socket.id,
        channelId,
      });
    } catch (error) {
      logger.error(`Error in typing-stop for ${socket.id}:`, error);
    }
  });

  // TYPING INDICATORS - CONVERSATIONS (DMs)

  socket.on("typing-start-conversation", (payload?: unknown) => {
    try {
      const conversationId = getPayloadId(payload, "conversationId");
      if (!conversationId) return;
      if (!checkTypingRateLimit(socket.id)) {
        return;
      }
      socket
        .to(`conversation:${conversationId}`)
        .emit("user-typing-conversation", {
          profileId: getSocketProfileId(socket) ?? socket.id,
          username: getSocketUsername(socket),
          conversationId,
        });
    } catch (error) {
      logger.error(
        `Error in typing-start-conversation for ${socket.id}:`,
        error,
      );
    }
  });

  socket.on("typing-stop-conversation", (payload?: unknown) => {
    try {
      const conversationId = getPayloadId(payload, "conversationId");
      if (!conversationId) return;
      socket
        .to(`conversation:${conversationId}`)
        .emit("user-stopped-typing-conversation", {
          profileId: getSocketProfileId(socket) ?? socket.id,
          conversationId,
        });
    } catch (error) {
      logger.error(
        `Error in typing-stop-conversation for ${socket.id}:`,
        error,
      );
    }
  });

  // JOIN/LEAVE CHANNEL

  socket.on("join-channel", async (payload?: unknown) => {
    try {
      const channelId = getPayloadId(payload, "channelId");
      if (!channelId) return;

      const profileId = getSocketProfileId(socket);
      if (!profileId) {
        logger.warn(
          `join-channel rejected: no profileId for socket ${socket.id}`,
        );
        return;
      }

      // SECURITY: Verify channel exists
      const channel = await getChannelByIdCached(channelId);
      if (!channel) {
        logger.warn(`join-channel rejected: channel ${channelId} not found`);
        return;
      }

      const boardId = getNonEmptyString(
        (channel as { boardId?: unknown }).boardId,
      );
      if (!boardId) {
        logger.warn(
          `join-channel rejected: channel ${channelId} has invalid boardId`,
        );
        return;
      }

      // SECURITY: Verify user is member of the board
      const board = await verifyMemberInBoardCached(profileId, boardId);
      if (!board) {
        logger.warn(
          `User ${profileId} tried to join channel ${channelId} without board membership`,
        );
        return;
      }

      socket.join(`channel:${channelId}`);
    } catch (error) {
      logger.error(`Error in join-channel for ${socket.id}:`, error);
    }
  });

  socket.on("leave-channel", (payload?: unknown) => {
    try {
      const channelId = getPayloadId(payload, "channelId");
      if (!channelId) return;
      socket.leave(`channel:${channelId}`);
    } catch (error) {
      logger.error(`Error in leave-channel for ${socket.id}:`, error);
    }
  });

  // JOIN/LEAVE BOARD

  socket.on("join-board", async (payload?: unknown) => {
    try {
      const boardId = getPayloadId(payload, "boardId");
      if (!boardId) return;

      const profileId = getSocketProfileId(socket);
      if (!profileId) {
        logger.warn(
          `join-board rejected: no profileId for socket ${socket.id}`,
        );
        return;
      }

      // SECURITY: Verify user is member of the board
      const board = await verifyMemberInBoardCached(profileId, boardId);
      if (!board) {
        logger.warn(
          `User ${profileId} tried to join board ${boardId} without membership`,
        );
        return;
      }

      socket.join(`board:${boardId}`);
      const roomName = `board:${boardId}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
      const socketCount = socketsInRoom ? socketsInRoom.size : 0;
      logger.info(
        `${socket.id} (profileId: ${profileId}) joined ${roomName} (now ${socketCount} sockets)`,
      );
    } catch (error) {
      logger.error(`Error in join-board for ${socket.id}:`, error);
    }
  });

  socket.on("leave-board", (payload?: unknown) => {
    try {
      const boardId = getPayloadId(payload, "boardId");
      if (!boardId) return;
      socket.leave(`board:${boardId}`);
    } catch (error) {
      logger.error(`Error in leave-board for ${socket.id}:`, error);
    }
  });

  // JOIN/LEAVE CONVERSATION (DMs)

  socket.on("join-conversation", async (payload?: unknown) => {
    try {
      const profileId = getSocketProfileId(socket);
      if (!profileId) {
        logger.warn(
          `join-conversation rejected: no profileId for socket ${socket.id}`,
        );
        return;
      }

      const conversationId = getPayloadId(payload, "conversationId");
      if (!conversationId) {
        logger.warn("join-conversation rejected: no conversationId provided");
        return;
      }

      // SECURITY: Verify user is a participant in the conversation
      const result = await findConversationForProfileCached(
        profileId,
        conversationId,
      );
      if (!result) {
        logger.warn(
          `User ${profileId} tried to join conversation ${conversationId} without being a participant`,
        );
        return;
      }

      socket.join(`conversation:${conversationId}`);
    } catch (error) {
      logger.error(`Error in join-conversation for ${socket.id}:`, error);
    }
  });

  socket.on("leave-conversation", (payload?: unknown) => {
    try {
      const conversationId = getPayloadId(payload, "conversationId");
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
    } catch (error) {
      logger.error(`Error in leave-conversation for ${socket.id}:`, error);
    }
  });
}
