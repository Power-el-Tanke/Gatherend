import { Router } from "express";
import {
  markConversationAsRead,
  getUnreadConversations,
} from "./conversation-read-state.service.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/conversation-read-state/unreads
 * Obtiene todas las conversaciones con mensajes no leídos para el usuario
 */
router.get("/unreads", async (req, res) => {
  try {
    const profileId = req.profile?.id;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const unreadCounts = await getUnreadConversations(profileId);

    return res.json(unreadCounts);
  } catch (error) {
    logger.error("[CONVERSATION_READ_STATE_UNREADS]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

/**
 * POST /api/conversation-read-state/:conversationId/read
 * Marca una conversación como leída
 */
router.post("/:conversationId/read", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    const { conversationId } = req.params;

    if (!profileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate UUID format
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const result = await markConversationAsRead(profileId, conversationId);

    if (!result.success) {
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (result.error === "NOT_PARTICIPANT") {
        return res.status(403).json({ error: "Not a participant" });
      }
      return res.status(500).json({ error: "Internal Error" });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error("[CONVERSATION_READ_STATE_MARK_READ]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
