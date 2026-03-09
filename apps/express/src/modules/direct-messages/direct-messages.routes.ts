import { Router } from "express";
import {
  createDirectMessage,
  getPaginatedDirectMessages,
  findConversationForProfile,
} from "./direct-messages.service.js";
import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import { attachFilePreviews } from "../../lib/chat-image-previews.js";
import {
  getSignedAttachmentsUrl,
  isPrivateAttachmentKey,
  isValidSignedAttachmentsUrlForKey,
} from "../../lib/attachments-gateway.js";

const router = Router();
const MESSAGES_BATCH = 40;

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// POST → enviar DM

router.post("/", async (req, res) => {
  const t0 = performance.now();

  try {
    const profileId = req.profile?.id;
    const { content, fileUrl, stickerId, replyToId, tempId } = req.body;
    const { conversationId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!conversationId || !UUID_REGEX.test(conversationId as string))
      return res.status(400).json({ error: "Invalid conversation ID" });
    if (!content && !fileUrl && !stickerId)
      return res.status(400).json({ error: "Message empty" });

    // 1. Verificar que el usuario pertenece a la conversación

    const result = await findConversationForProfile(
      profileId,
      conversationId as string,
    );

    if (!result)
      return res.status(404).json({ error: "Conversation not found" });

    const { conversation, currentProfile, otherProfile } = result;

    // 2. Parseo de archivo (si existe)

    let actualFileUrl = null;
    let actualFileKey: string | null = null;
    let fileName = null;
    let fileType = null;
    let fileSize = null;
    let fileWidth: number | null = null;
    let fileHeight: number | null = null;
    let parsedSignedUrlCandidate: string | null = null;

    try {
      if (fileUrl) {
        const fileData =
          typeof fileUrl === "string" && fileUrl.startsWith("https")
            ? { url: fileUrl }
            : JSON.parse(fileUrl);

        actualFileUrl = typeof fileData.url === "string" ? fileData.url : null;
        parsedSignedUrlCandidate = actualFileUrl;
        actualFileKey = typeof fileData.key === "string" ? fileData.key : null;
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
      }
    } catch (err) {
      logger.error("Error parsing fileUrl:", err);
    }

    if (actualFileKey) {
      if (actualFileKey.length > 512) {
        return res.status(400).json({ error: "Invalid attachment" });
      }
      if (actualFileKey.includes("\\") || actualFileKey.split("/").includes("..")) {
        return res.status(400).json({ error: "Invalid attachment" });
      }
      // DMs should never accept channel attachment keys.
      if (actualFileKey.startsWith("chat-attachments/")) {
        return res.status(400).json({ error: "Invalid attachment" });
      }

      if (isPrivateAttachmentKey(actualFileKey)) {
        if (
          !parsedSignedUrlCandidate ||
          typeof parsedSignedUrlCandidate !== "string" ||
          !isValidSignedAttachmentsUrlForKey(parsedSignedUrlCandidate, actualFileKey)
        ) {
          return res.status(400).json({ error: "Invalid attachment" });
        }
      }
    }

    // Never persist expiring signed URLs for private attachments.
    if (actualFileKey && isPrivateAttachmentKey(actualFileKey)) {
      actualFileUrl = null;
    }

    // 3. Guardar mensaje en DB (también actualiza updatedAt de la conversación)

    const savedMessage = await createDirectMessage({
      content: content || "",
      fileUrl: actualFileUrl,
      fileKey: actualFileKey,
      stickerId,
      fileName,
      fileType,
      fileSize,
      fileWidth,
      fileHeight,
      conversationId: conversation.id,
      conversationProfileOneId: conversation.profileOneId ?? null,
      conversationProfileTwoId: conversation.profileTwoId ?? null,
      senderId: profileId,
      unhideForProfileId: otherProfile?.id ?? null,
      replyToId,
    });

    // 4. Emitir mensaje REAL con sender completo

    const eventKey = `chat:${conversationId}:messages`;
    const savedMessageWithPreviews = attachFilePreviews(
      withSignedAttachmentUrls(savedMessage as any),
    );

    // Include tempId for optimistic message matching
    const messageWithTempId = tempId
      ? { ...savedMessageWithPreviews, tempId }
      : savedMessageWithPreviews;
    req.io
      .to(`conversation:${conversationId}`)
      .emit(eventKey, messageWithTempId);

    // 5. Emitir evento global al perfil del destinatario para notificaciones

    req.io
      .to(`profile:${otherProfile.id}`)
      .emit("global:conversation:message", {
        conversationId: conversation.id,
        messageTimestamp: Date.now(), // timestamp para comparar con lastAck en cliente
        sender: currentProfile,
        lastMessage: {
          content: savedMessage.content,
          fileUrl: (messageWithTempId as any).fileUrl ?? null,
          deleted: false,
          senderId: profileId,
        },
      });

    return res.json(messageWithTempId);
  } catch (error) {
    logger.error("[DM_POST]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// GET → paginación de DM (bidireccional)

router.get("/", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { conversationId, cursor, direction } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!conversationId || !UUID_REGEX.test(conversationId as string))
      return res.status(400).json({ error: "Invalid conversation ID" });
    if (cursor && !UUID_REGEX.test(cursor as string))
      return res.status(400).json({ error: "Invalid cursor" });

    // Verificar que el usuario pertenece a la conversación
    const validConv = await findConversationForProfile(
      profileId,
      conversationId as string,
    );

    if (!validConv)
      return res.status(404).json({ error: "Conversation not found" });

    const dir = direction === "after" ? "after" : "before";

    const messages = await getPaginatedDirectMessages(
      conversationId as string,
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
    const hasMore = messages.length === MESSAGES_BATCH;

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
  } catch (error) {
    logger.error("[DM_GET]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// PATCH → Editar DM

router.patch("/:directMessageId", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { content } = req.body;
    const { directMessageId } = req.params;
    const { conversationId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!directMessageId || !UUID_REGEX.test(directMessageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!conversationId || !UUID_REGEX.test(conversationId as string))
      return res.status(400).json({ error: "Invalid conversation ID" });
    if (!content) return res.status(400).json({ error: "Content missing" });

    // Validar conversación
    const validConv = await findConversationForProfile(
      profileId,
      conversationId as string,
    );

    if (!validConv)
      return res.status(404).json({ error: "Conversation not found" });

    // Buscar mensaje
    let message = await db.directMessage.findFirst({
      where: {
        id: directMessageId,
        conversationId: conversationId as string,
      },
      include: {
        sender: true,
      },
    });

    if (!message || message.deleted)
      return res.status(404).json({ error: "Message not found" });

    // Solo el dueño puede editar
    if (message.senderId !== profileId)
      return res.status(401).json({ error: "Unauthorized" });

    // No editar si tiene archivo
    if (message.fileUrl)
      return res.status(400).json({ error: "Cannot edit message with file" });

    // No editar si es un sticker
    if (message.stickerId)
      return res.status(400).json({ error: "Cannot edit sticker message" });

    // Actualizar mensaje
    message = await db.directMessage.update({
      where: { id: directMessageId },
      data: { content },
      include: {
        sender: true,
      },
    });

    // Emitir UPDATE
    const updateKey = `chat:${conversationId}:messages:update`;
    req.io.to(`conversation:${conversationId}`).emit(updateKey, message);

    return res.json(message);
  } catch (error) {
    logger.error("[DM_PATCH]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE → Soft delete DM

router.delete("/:directMessageId", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { directMessageId } = req.params;
    const { conversationId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!directMessageId || !UUID_REGEX.test(directMessageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!conversationId || !UUID_REGEX.test(conversationId as string))
      return res.status(400).json({ error: "Invalid conversation ID" });

    // validar conversación
    const validConv = await findConversationForProfile(
      profileId,
      conversationId as string,
    );

    if (!validConv)
      return res.status(404).json({ error: "Conversation not found" });

    // obtener mensaje
    let message = await db.directMessage.findFirst({
      where: {
        id: directMessageId,
        conversationId: conversationId as string,
      },
      include: {
        sender: true,
      },
    });

    if (!message || message.deleted)
      return res.status(404).json({ error: "Message not found" });

    // solo dueño puede borrar
    if (message.senderId !== profileId)
      return res.status(401).json({ error: "Unauthorized" });

    // Hard delete the message from DB
    await db.directMessage.delete({
      where: { id: directMessageId },
    });

    // Emit update with deleted: true so clients remove it from cache
    const updateKey = `chat:${conversationId}:messages:update`;
    req.io
      .to(`conversation:${conversationId}`)
      .emit(updateKey, { id: directMessageId, deleted: true });

    return res.json({ success: true, id: directMessageId });
  } catch (error) {
    logger.error("[DM_DELETE]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// POST → Pin Direct Message

router.post("/:messageId/pin", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { messageId } = req.params;
    const { conversationId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!conversationId || !UUID_REGEX.test(conversationId as string))
      return res.status(400).json({ error: "Invalid conversation ID" });

    const result = await findConversationForProfile(
      profileId,
      conversationId as string,
    );
    if (!result)
      return res.status(404).json({ error: "Conversation not found" });

    // Get original message to preserve updatedAt
    const originalMessage = await db.directMessage.findUnique({
      where: { id: messageId },
      select: { updatedAt: true },
    });

    const message = await db.directMessage.update({
      where: { id: messageId },
      data: {
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: profileId,
        // Preserve original updatedAt so it doesn't show as "edited"
        updatedAt: originalMessage?.updatedAt,
      },
      include: {
        sender: true,
        sticker: true,
        reactions: {
          include: {
            profile: true,
          },
        },
        replyTo: {
          include: {
            sender: true,
          },
        },
      },
    });

    const updateKey = `chat:${conversationId}:messages:update`;
    req.io.to(`conversation:${conversationId}`).emit(updateKey, message);

    return res.json(message);
  } catch (error) {
    logger.error("[DM_PIN]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE → Unpin Direct Message

router.delete("/:messageId/pin", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { messageId } = req.params;
    const { conversationId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!messageId || !UUID_REGEX.test(messageId))
      return res.status(400).json({ error: "Invalid message ID" });
    if (!conversationId || !UUID_REGEX.test(conversationId as string))
      return res.status(400).json({ error: "Invalid conversation ID" });

    const result = await findConversationForProfile(
      profileId,
      conversationId as string,
    );
    if (!result)
      return res.status(404).json({ error: "Conversation not found" });

    // Get original message to preserve updatedAt
    const originalMessage = await db.directMessage.findUnique({
      where: { id: messageId },
      select: { updatedAt: true },
    });

    const message = await db.directMessage.update({
      where: { id: messageId },
      data: {
        pinned: false,
        pinnedAt: null,
        pinnedById: null,
        // Preserve original updatedAt so it doesn't show as "edited"
        updatedAt: originalMessage?.updatedAt,
      },
      include: {
        sender: true,
        sticker: true,
        reactions: {
          include: {
            profile: true,
          },
        },
        replyTo: {
          include: {
            sender: true,
          },
        },
      },
    });

    const updateKey = `chat:${conversationId}:messages:update`;
    req.io.to(`conversation:${conversationId}`).emit(updateKey, message);

    return res.json(message);
  } catch (error) {
    logger.error("[DM_UNPIN]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// GET → Get Pinned Direct Messages

router.get("/pinned", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { conversationId } = req.query;

    if (!profileId) return res.status(401).json({ error: "Unauthorized" });
    if (!conversationId || !UUID_REGEX.test(conversationId as string))
      return res.status(400).json({ error: "Invalid conversation ID" });

    const result = await findConversationForProfile(
      profileId,
      conversationId as string,
    );
    if (!result)
      return res.status(404).json({ error: "Conversation not found" });

    const pinnedMessages = await db.directMessage.findMany({
      where: {
        conversationId: conversationId as string,
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
        sender: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
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
    logger.error("[GET_PINNED_DMS]", error);
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
