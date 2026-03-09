import { db } from "../../lib/db.js";
import { findConversationForProfileCached } from "../../lib/cache.js";

// Reusable profile select fields for customization
const profileSelect = {
  id: true,
  username: true,
  imageUrl: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  badgeStickerUrl: true,
  usernameFormat: true,
  // longDescription omitido - no se necesita en lista de mensajes
};

/**
 * Verifica que un usuario pertenece a una conversación.
 * Usa cache de Redis para evitar queries repetitivas.
 *
 * @returns Objeto con conversation, currentProfile y otherProfile, o null si no tiene acceso
 */
export const findConversationForProfile = async (
  profileId: string,
  conversationId: string,
) => {
  // Usar cache para validación - las conversaciones no cambian una vez creadas
  const cached = await findConversationForProfileCached(
    profileId,
    conversationId,
  );

  if (!cached) return null;

  // Para mantener compatibilidad con el código existente que espera
  // los objetos profile completos, hacemos una query adicional solo
  // cuando necesitamos los datos completos (no en validación básica)
  const { conversation, currentProfileId, otherProfileId } = cached;

  return {
    conversation: {
      ...conversation,
      profileOne: conversation.profileOne,
      profileTwo: conversation.profileTwo,
    },
    currentProfile:
      conversation.profileOneId === currentProfileId
        ? conversation.profileOne
        : conversation.profileTwo,
    otherProfile:
      conversation.profileOneId === otherProfileId
        ? conversation.profileOne
        : conversation.profileTwo,
  };
};

export const createDirectMessage = async (data: {
  content: string;
  fileUrl: string | null;
  fileKey?: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  fileWidth?: number | null;
  fileHeight?: number | null;
  conversationId: string;
  conversationProfileOneId?: string | null;
  conversationProfileTwoId?: string | null;
  senderId: string;
  unhideForProfileId?: string | null;
  stickerId?: string | null;
  replyToId?: string | null;
}) => {
  // Usar transacción para crear mensaje y actualizar updatedAt de la conversación
  // Esto asegura que la lista de DMs se ordene correctamente por actividad reciente
  const {
    conversationProfileOneId = null,
    conversationProfileTwoId = null,
    unhideForProfileId = null,
    ...messageData
  } = data;

  const updateConversationData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  // If the recipient had hidden this conversation, unhide it so it reappears
  // in `/api/conversations/list` after a new incoming message.
  if (unhideForProfileId) {
    if (conversationProfileOneId === unhideForProfileId) {
      updateConversationData.hiddenByOneAt = null;
    }
    if (conversationProfileTwoId === unhideForProfileId) {
      updateConversationData.hiddenByTwoAt = null;
    }
  }

  const [message] = await db.$transaction([
    db.directMessage.create({
      data: messageData,
      select: {
        id: true,
        content: true,
        fileUrl: true,
        fileKey: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        fileWidth: true,
        fileHeight: true,
        conversationId: true,
        deleted: true,
        pinned: true,
        pinnedAt: true,
        createdAt: true,
        updatedAt: true,
        sender: {
          select: profileSelect,
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
              select: profileSelect,
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            fileUrl: true,
            fileKey: true,
            fileName: true,
            fileWidth: true,
            fileHeight: true,
            sender: {
              select: profileSelect,
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
    }),
    db.conversation.update({
      where: { id: data.conversationId },
      data: updateConversationData,
    }),
  ]);

  return message;
};

/**
 * Obtiene mensajes directos paginados con soporte bidireccional
 *
 * @param conversationId - ID de la conversación
 * @param cursor - ID del mensaje como punto de referencia
 * @param direction - 'before' para mensajes más antiguos, 'after' para más nuevos
 *
 * NO usar cache para mensajes de chat - son datos en tiempo real.
 * Los mensajes nuevos se sincronizan via WebSocket.
 */
export const getPaginatedDirectMessages = async (
  conversationId: string,
  cursor?: string,
  direction: "before" | "after" = "before",
) => {
  const selectFields = {
    id: true,
    content: true,
    fileUrl: true,
    fileKey: true,
    fileName: true,
    fileType: true,
    fileSize: true,
    fileWidth: true,
    fileHeight: true,
    conversationId: true,
    deleted: true,
    pinned: true,
    pinnedAt: true,
    createdAt: true,
    updatedAt: true,
    sender: {
      select: profileSelect,
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
          select: profileSelect,
        },
      },
    },
    replyTo: {
      select: {
        id: true,
        content: true,
        fileUrl: true,
        fileKey: true,
        fileName: true,
        fileWidth: true,
        fileHeight: true,
        sender: {
          select: profileSelect,
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
  };

  // NO usar cache para mensajes de chat - los mensajes son datos en tiempo real
  // El cache de Prisma Accelerate causaba que los mensajes nuevos no aparecieran
  // hasta que el cache expiraba (30-60 segundos), lo cual es inaceptable para chat.
  // Los mensajes nuevos mientras el usuario está en el chat se manejan via WebSocket.

  if (direction === "after" && cursor) {
    // Fetch messages NEWER than cursor (for scrolling DOWN to recent messages)
    // Use 'asc' order then reverse to maintain consistent format
    const messages = await db.directMessage.findMany({
      take: 40,
      skip: 1, // Skip the cursor itself
      cursor: { id: cursor },
      where: { conversationId },
      select: selectFields,
      orderBy: { createdAt: "asc" }, // Get newer messages
    });
    // Reverse to maintain newest-first order for client
    return messages.reverse();
  }

  // Default: fetch messages OLDER than cursor (for scrolling UP to history)
  return db.directMessage.findMany({
    take: 40,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    where: { conversationId },
    select: selectFields,
    orderBy: { createdAt: "desc" },
  });
};
