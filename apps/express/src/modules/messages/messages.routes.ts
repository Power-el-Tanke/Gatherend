import { Router } from "express";
import {
  createMessage,
  getPaginatedMessages,
  getMessage,
  updateMessageContent,
  hardDeleteMessage,
  extractMentionIdentifiers,
  resolveProfileIds,
  createMentions,
} from "./messages.service.js";
import {
  verifyMemberInBoardCached,
  findChannelCached,
} from "../../lib/cache.js";
import { incrementUnreadForChannel } from "../channel-read-state/channel-read-state.service.js";
import { MemberRole, MessageType } from "@prisma/client";
import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import { attachFilePreviews } from "../../lib/chat-image-previews.js";
import {
  getSignedAttachmentsUrl,
  isPrivateAttachmentKey,
  isValidSignedAttachmentsUrlForKey,
} from "../../lib/attachments-gateway.js";

const router = Router();

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// POST → Enviar Mensaje

router.post("/", async (req, res) => {
  const startTime = Date.now();
  try {
    const profileId = req.profile?.id;
    const { boardId, channelId } = req.query;
    const { content, fileUrl, stickerId, replyToId, tempId } = req.body;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!content && !fileUrl && !stickerId)
      return res.status(400).json({ error: "Content missing" });

    const board = await verifyMemberInBoardCached(profileId, boardId as string);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Parse fileUrl if it's a JSON string with metadata
    let parsedFileUrl: string | null = fileUrl ?? null;
    let parsedFileKey: string | null = null;
    let fileName = null;
    let fileType = null;
    let fileSize = null;
    let fileWidth: number | null = null;
    let fileHeight: number | null = null;
    let parsedSignedUrlCandidate: string | null = null;

    if (fileUrl && typeof fileUrl === "string") {
      try {
        const fileData = JSON.parse(fileUrl);
        parsedFileUrl = typeof fileData.url === "string" ? fileData.url : null;
        parsedSignedUrlCandidate = parsedFileUrl;
        parsedFileKey = typeof fileData.key === "string" ? fileData.key : null;
        fileName = fileData.name || null;
        fileType = fileData.type || null;
        fileSize = fileData.size || null;
        fileWidth =
          typeof fileData.width === "number"
            ? Math.round(fileData.width)
            : null;
        fileHeight =
          typeof fileData.height === "number"
            ? Math.round(fileData.height)
            : null;
      } catch {
        // If not JSON, use as-is (backward compatibility)
        parsedFileUrl = fileUrl;
      }
    }

    if (parsedFileKey) {
      if (parsedFileKey.length > 512) {
        return res.status(400).json({ error: "Invalid attachment" });
      }
      if (parsedFileKey.includes("\\") || parsedFileKey.split("/").includes("..")) {
        return res.status(400).json({ error: "Invalid attachment" });
      }
      // Channel messages should never accept DM attachment keys.
      if (parsedFileKey.startsWith("dm-attachments/")) {
        return res.status(400).json({ error: "Invalid attachment" });
      }

      if (isPrivateAttachmentKey(parsedFileKey)) {
        if (
          !parsedSignedUrlCandidate ||
          typeof parsedSignedUrlCandidate !== "string" ||
          !isValidSignedAttachmentsUrlForKey(parsedSignedUrlCandidate, parsedFileKey)
        ) {
          return res.status(400).json({ error: "Invalid attachment" });
        }
      }
    }

    // Never persist expiring signed URLs for private attachments.
    if (parsedFileKey && isPrivateAttachmentKey(parsedFileKey)) {
      parsedFileUrl = null;
    }

    let type: MessageType = MessageType.TEXT;
    if (stickerId) {
      type = MessageType.STICKER;
    } else if (parsedFileUrl || parsedFileKey) {
      type = MessageType.IMAGE;
    }

    const message = await createMessage({
      content: content || "",
      fileUrl: parsedFileUrl,
      fileKey: parsedFileKey,
      stickerId,
      fileName,
      fileType,
      fileSize,
      fileWidth,
      fileHeight,
      channelId: channelId as string,
      memberId: member.id,
      type,
      replyToId,
    });

    // Usar el profile que ya viene del cache de member verification (evita query extra)
    const senderProfile = member.profile;

    // Procesar menciones si hay contenido
    if (content) {
      const mentionIdentifiers = extractMentionIdentifiers(content);
      const mentionedProfileIds = await resolveProfileIds(mentionIdentifiers);

      if (mentionedProfileIds.length > 0) {
        // Crear las menciones en la base de datos
        await createMentions(message.id, mentionedProfileIds);

        // Emitir notificación a cada usuario mencionado
        for (const mentionedProfileId of mentionedProfileIds) {
          // No notificar si se menciona a sí mismo
          if (mentionedProfileId !== member.profileId) {
            req.io.emit(`mention:${mentionedProfileId}`, {
              messageId: message.id,
              channelId,
              boardId,
              sender: senderProfile,
              content: content.substring(0, 100), // Preview del mensaje
            });
          }
        }
      }
    }

    const eventKey = `chat:${channelId}:messages`;
    const roomName = `channel:${channelId}`;

    // Debug: solo en desarrollo para ver cuántos clientes están en la sala
    if (process.env.NODE_ENV !== "production") {
      await req.io.in(roomName).fetchSockets();
    }

    const messageWithSignedUrl = withSignedAttachmentUrls(message);

    const messageWithPreviews = attachFilePreviews(messageWithSignedUrl);

    // Include tempId for optimistic message matching
    const messageWithTempId = tempId
      ? { ...messageWithPreviews, tempId }
      : messageWithPreviews;
    req.io.to(roomName).emit(eventKey, messageWithTempId);

    // Emitir evento global al board para notificaciones de usuarios en otros canales
    req.io.to(`board:${boardId}`).emit("global:channel:message", {
      channelId,
      boardId,
      messageTimestamp: Date.now(), // timestamp para comparar con lastAck en cliente
      member: {
        ...member,
        profile: senderProfile,
      },
    });

    // Incrementar el contador de no leídos en la base de datos para todos los miembros
    await incrementUnreadForChannel(
      channelId as string,
      boardId as string,
      member.profileId,
    );

    return res.json(messageWithTempId);
  } catch (err) {
    logger.error("[MESSAGE_POST]", err);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// GET → Obtener mensajes (Paginado, Bidireccional)

router.get("/", async (req, res) => {
  try {
    const { channelId, boardId, cursor, direction } = req.query;
    // Header
    const profileId = req.profile?.id;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (cursor && !UUID_REGEX.test(cursor as string))
      return res.status(400).json({ error: "Invalid cursor" });

    // Usar findChannelCached para verificar que el canal existe y pertenece al board
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );

    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const dir = direction === "after" ? "after" : "before";

    const messages = await getPaginatedMessages(
      channelId as string,
      cursor as string | undefined,
      dir,
    );

    const items = messages
      .map((m) => withSignedAttachmentUrls(m as any))
      .map((m) => attachFilePreviews(m));

    // Bidirectional cursors:
    // - nextCursor: ID of oldest message in this batch (for fetching older messages)
    // - previousCursor: ID of newest message in this batch (for fetching newer messages)
    //
    // When scrolling UP (loading history): use nextCursor
    // When scrolling DOWN (after eviction): use previousCursor
    const PAGE_SIZE = 40;
    const hasMore = messages.length === PAGE_SIZE;

    // Always provide both cursors when we have messages
    // This enables bidirectional pagination from any point
    const newestMessageId = messages[0]?.id || null;
    const oldestMessageId = messages[messages.length - 1]?.id || null;

    if (dir === "after") {
      // When fetching newer messages:
      // - previousCursor points to even NEWER messages (if there are more)
      // - nextCursor points to OLDER messages (always available since we came from older)
      const response = {
        items,
        previousCursor: hasMore ? newestMessageId : null,
        nextCursor: oldestMessageId,
      };
      return res.json(response);
    } else {
      // When fetching older messages (default):
      // - nextCursor points to even OLDER messages (if there are more)
      // - previousCursor points to NEWER messages (the first msg in this batch)
      return res.json({
        items,
        nextCursor: hasMore ? oldestMessageId : null,
        previousCursor: cursor ? newestMessageId : null, // Only if not initial load
      });
    }
  } catch (err) {
    logger.error("[MESSAGE_GET]", err);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// PATCH → Editar Mensaje

router.patch("/:messageId", async (req, res) => {
  try {
    // Header
    const profileId = req.profile?.id;

    const { messageId } = req.params;
    const { boardId, channelId } = req.query;
    const { content } = req.body;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!content) return res.status(400).json({ error: "Content missing" });

    const board = await verifyMemberInBoardCached(profileId, boardId as string);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    let message = await getMessage(messageId, channelId as string);
    if (!message || message.deleted)
      return res.status(404).json({ error: "Message not found" });

    const isOwner = message.member.id === member.id;
    if (!isOwner) return res.status(401).json({ error: "Unauthorized" });

    if (message.fileUrl)
      return res.status(400).json({ error: "Cannot edit message with file" });

    if (message.sticker)
      return res.status(400).json({ error: "Cannot edit sticker message" });

    message = await updateMessageContent(messageId, content);

    const updateKey = `chat:${channelId}:messages:update`;
    req.io.to(`channel:${channelId}`).emit(updateKey, message);

    return res.json(message);
  } catch (error) {
    logger.error("[MESSAGE_PATCH]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE → Borrar Mensaje

router.delete("/:messageId", async (req, res) => {
  try {
    // Header
    const profileId = req.profile?.id;

    const { messageId } = req.params;
    const { boardId, channelId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });

    const board = await verifyMemberInBoardCached(profileId, boardId as string);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    let message = await getMessage(messageId, channelId as string);
    if (!message || message.deleted)
      return res.status(404).json({ error: "Message not found" });

    const isMessageOwner = message.member.id === member.id;
    const isBoardOwner = member.role === MemberRole.OWNER;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;

    if (!isMessageOwner && !isBoardOwner && !isAdmin && !isModerator)
      return res.status(401).json({ error: "Unauthorized" });

    // Hard delete the message from DB
    await hardDeleteMessage(messageId);

    // Emit update with deleted: true so clients remove it from cache
    const updateKey = `chat:${channelId}:messages:update`;
    req.io
      .to(`channel:${channelId}`)
      .emit(updateKey, { id: messageId, deleted: true });

    return res.json({ success: true, id: messageId });
  } catch (error) {
    logger.error("[MESSAGE_DELETE]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// POST → Pin Message

router.post("/:messageId/pin", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { messageId } = req.params;
    const { channelId, boardId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });

    // Usar findChannelCached para evitar query extra
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Check permissions (only admins, mods, or owner can pin)
    const isOwner = member.role === MemberRole.OWNER;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;

    if (!isOwner && !isAdmin && !isModerator) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Get original message to preserve updatedAt
    const originalMessage = await db.message.findUnique({
      where: { id: messageId },
      select: { updatedAt: true },
    });

    const message = await db.message.update({
      where: { id: messageId },
      data: {
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: profileId,
        // Preserve original updatedAt so it doesn't show as "edited"
        updatedAt: originalMessage?.updatedAt,
      },
      select: {
        id: true,
        content: true,
        type: true,
        fileUrl: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        fileWidth: true,
        fileHeight: true,
        channelId: true,
        deleted: true,
        pinned: true,
        pinnedAt: true,
        createdAt: true,
        updatedAt: true,
        member: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
                usernameColor: true,
                profileTags: true,
                badge: true,
                badgeStickerUrl: true,
                usernameFormat: true,
              },
            },
          },
        },
        sticker: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            category: true,
          },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            profileId: true,
            profile: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
                usernameColor: true,
                profileTags: true,
                badge: true,
                badgeStickerUrl: true,
                usernameFormat: true,
              },
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            fileUrl: true,
            fileName: true,
            fileWidth: true,
            fileHeight: true,
            member: {
              select: {
                id: true,
                profile: {
                  select: {
                    id: true,
                    username: true,
                    imageUrl: true,
                    usernameColor: true,
                    profileTags: true,
                    badge: true,
                    badgeStickerUrl: true,
                    usernameFormat: true,
                  },
                },
              },
            },
            sticker: {
              select: {
                id: true,
                imageUrl: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const updateKey = `chat:${channelId}:messages:update`;
    req.io.to(`channel:${channelId}`).emit(updateKey, message);

    return res.json(message);
  } catch (error) {
    logger.error("[MESSAGE_PIN]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE → Unpin Message

router.delete("/:messageId/pin", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { messageId } = req.params;
    const { channelId, boardId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });

    // Usar findChannelCached para evitar query extra
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const member = board.members.find((m) => m.profileId === profileId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Check permissions
    const isOwner = member.role === MemberRole.OWNER;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;

    if (!isOwner && !isAdmin && !isModerator) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Get original message to preserve updatedAt
    const originalMessage = await db.message.findUnique({
      where: { id: messageId },
      select: { updatedAt: true },
    });

    const message = await db.message.update({
      where: { id: messageId },
      data: {
        pinned: false,
        pinnedAt: null,
        pinnedById: null,
        // Preserve original updatedAt so it doesn't show as "edited"
        updatedAt: originalMessage?.updatedAt,
      },
      select: {
        id: true,
        content: true,
        type: true,
        fileUrl: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        fileWidth: true,
        fileHeight: true,
        channelId: true,
        deleted: true,
        pinned: true,
        pinnedAt: true,
        createdAt: true,
        updatedAt: true,
        member: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
                usernameColor: true,
                profileTags: true,
                badge: true,
                badgeStickerUrl: true,
                usernameFormat: true,
              },
            },
          },
        },
        sticker: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            category: true,
          },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            profileId: true,
            profile: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
                usernameColor: true,
                profileTags: true,
                badge: true,
                badgeStickerUrl: true,
                usernameFormat: true,
              },
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            fileUrl: true,
            fileName: true,
            fileWidth: true,
            fileHeight: true,
            member: {
              select: {
                id: true,
                profile: {
                  select: {
                    id: true,
                    username: true,
                    imageUrl: true,
                    usernameColor: true,
                    profileTags: true,
                    badge: true,
                    badgeStickerUrl: true,
                    usernameFormat: true,
                  },
                },
              },
            },
            sticker: {
              select: {
                id: true,
                imageUrl: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const updateKey = `chat:${channelId}:messages:update`;
    req.io.to(`channel:${channelId}`).emit(updateKey, message);

    return res.json(message);
  } catch (error) {
    logger.error("[MESSAGE_UNPIN]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// GET → Get Pinned Messages

router.get("/pinned", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { channelId, boardId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!channelId || !UUID_REGEX.test(channelId as string))
      return res.status(400).json({ error: "Invalid channel ID" });
    if (!boardId || !UUID_REGEX.test(boardId as string))
      return res.status(400).json({ error: "Invalid board ID" });

    // Usar findChannelCached para evitar query extra
    const channel = await findChannelCached(
      boardId as string,
      channelId as string,
    );
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const board = await verifyMemberInBoardCached(profileId, channel.boardId);
    if (!board) return res.status(403).json({ error: "Access denied" });

    const pinnedMessages = await db.message.findMany({
      where: {
        channelId: channelId as string,
        pinned: true,
        deleted: false,
      },
      take: 20,
      orderBy: { pinnedAt: "desc" },
      select: {
        id: true,
        content: true,
        fileUrl: true,
        fileName: true,
        fileType: true,
        createdAt: true,
        pinnedAt: true,
        member: {
          select: {
            profile: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
              },
            },
          },
        },
        sticker: {
          select: {
            id: true,
            imageUrl: true,
            name: true,
          },
        },
      },
    });

    return res.json(pinnedMessages);
  } catch (error) {
    logger.error("[GET_PINNED_MESSAGES]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
const withSignedAttachmentUrls = <
  T extends { fileKey?: string | null; fileUrl?: string | null; replyTo?: any },
>(
  m: T,
): T => {
  const out: any = { ...m };
  if (out.fileKey && isPrivateAttachmentKey(out.fileKey)) {
    out.fileUrl = getSignedAttachmentsUrl(out.fileKey);
  }
  if (
    out.replyTo &&
    out.replyTo.fileKey &&
    isPrivateAttachmentKey(out.replyTo.fileKey)
  ) {
    out.replyTo = {
      ...out.replyTo,
      fileUrl: getSignedAttachmentsUrl(out.replyTo.fileKey),
    };
  }
  return out as T;
};
