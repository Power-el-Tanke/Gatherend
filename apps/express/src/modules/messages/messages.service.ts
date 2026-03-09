import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";

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
 * Extrae los username/discriminator de las menciones de un contenido
 * Formato de mención: @[username]/[discriminator]
 */
export function extractMentionIdentifiers(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\/\[([^\]]+)\]/g;
  const identifiers: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    identifiers.push(`${match[1]}/${match[2]}`); // username/discriminator
  }

  return [...new Set(identifiers)]; // Remove duplicates
}

/**
 * Resuelve los username/discriminator a profileIds
 * Optimizado: Usa una sola query batch en lugar de N queries individuales
 */
export async function resolveProfileIds(
  identifiers: string[],
): Promise<string[]> {
  if (identifiers.length === 0) return [];

  try {
    // Parsear todos los identificadores y filtrar los inválidos
    const conditions = identifiers
      .map((identifier) => {
        const [username, discriminator] = identifier.split("/");
        if (!username || !discriminator) return null;
        return { username, discriminator };
      })
      .filter(
        (condition): condition is { username: string; discriminator: string } =>
          condition !== null,
      );

    if (conditions.length === 0) return [];

    // Una sola query para todos los perfiles
    const profiles = await db.profile.findMany({
      where: {
        OR: conditions,
      },
      select: { id: true },
    });

    return profiles.map((p) => p.id);
  } catch (error) {
    logger.error("[resolveProfileIds] Database error:", error);
    return []; // Return empty array on error - mentions are not critical
  }
}

/**
 * Crea las menciones en la base de datos para un mensaje
 */
export async function createMentions(messageId: string, profileIds: string[]) {
  if (profileIds.length === 0) return [];

  try {
    const mentions = await db.mention.createMany({
      data: profileIds.map((profileId) => ({
        messageId,
        profileId,
      })),
      skipDuplicates: true,
    });

    return mentions;
  } catch (error) {
    logger.error("[createMentions] Database error:", error);
    return { count: 0 }; // Return empty result on error - mentions are not critical
  }
}

export async function verifyMemberInBoard(profileId: string, boardId: string) {
  return db.board.findFirst({
    where: {
      id: boardId,
      members: { some: { profileId } },
    },
    include: { members: true },
  });
}

export async function findChannel(boardId: string, channelId: string) {
  return db.channel.findFirst({
    where: { id: channelId, boardId },
  });
}

export function createMessage({
  content,
  fileUrl,
  fileKey,
  fileName,
  fileType,
  fileSize,
  fileWidth,
  fileHeight,
  channelId,
  memberId,
  stickerId,
  type,
  replyToId,
}) {
  return db.message.create({
    data: {
      content,
      fileUrl,
      fileKey,
      fileName,
      fileType,
      fileSize,
      fileWidth,
      fileHeight,
      channelId,
      memberId,
      stickerId,
      type,
      replyToId,
    },
    select: {
      id: true,
      content: true,
      type: true,
      fileUrl: true,
      fileKey: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      fileWidth: true,
      fileHeight: true,
      channelId: true,
      deleted: true,
      createdAt: true,
      updatedAt: true,
      member: {
        select: {
          id: true,
          role: true,
          profile: {
            select: profileSelect,
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
      replyTo: {
        select: {
          id: true,
          content: true,
          fileUrl: true,
          fileKey: true,
          fileName: true,
          fileWidth: true,
          fileHeight: true,
          member: {
            select: {
              id: true,
              profile: {
                select: profileSelect,
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
}

/**
 * Obtiene mensajes paginados con cursor-based pagination optimizado.
 *
 * Estrategia: Usamos cursor por ID con ordenación por createdAt DESC.
 * El índice compuesto @@index([channelId, createdAt(sort: Desc)]) permite
 * búsquedas eficientes incluso con millones de mensajes.
 *
 * Para escalar a miles de mensajes:
 * - PAGE_SIZE de 40 es óptimo para chat
 * - El cursor evita el problema de offset pagination (O(n) → O(1))
 * - El índice compuesto hace que la query sea O(log n)
 *
 * NO usar cache para mensajes de chat - son datos en tiempo real.
 * Los mensajes nuevos se sincronizan via WebSocket.
 *
 * @param channelId - ID del canal
 * @param cursor - ID del mensaje como punto de referencia
 * @param direction - 'before' para mensajes más antiguos, 'after' para más nuevos
 */
export function getPaginatedMessages(
  channelId: string,
  cursor?: string,
  direction: "before" | "after" = "before",
) {
  const PAGE_SIZE = 40;

  const selectFields = {
    id: true,
    content: true,
    type: true,
    fileUrl: true,
    fileKey: true,
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
          select: profileSelect,
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
        member: {
          select: {
            id: true,
            profile: {
              select: profileSelect,
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
  };

  // NO usar cache para mensajes de chat - los mensajes son datos en tiempo real
  // El cache de Prisma Accelerate causaba que los mensajes nuevos no aparecieran
  // hasta que el cache expiraba (30-60 segundos), lo cual es inaceptable para chat.
  // Los mensajes nuevos mientras el usuario está en el chat se manejan via WebSocket.

  if (direction === "after" && cursor) {
    // Fetch messages NEWER than cursor (for scrolling DOWN to recent messages)
    return db.message
      .findMany({
        take: PAGE_SIZE,
        skip: 1, // Skip the cursor itself
        cursor: { id: cursor },
        where: { channelId },
        select: selectFields,
        orderBy: { createdAt: "asc" }, // Get newer messages
      })
      .then((messages) => messages.reverse()); // Reverse to maintain newest-first order
  }

  if (cursor) {
    return db.message.findMany({
      take: PAGE_SIZE,
      skip: 1,
      cursor: { id: cursor },
      where: { channelId },
      select: selectFields,
      orderBy: { createdAt: "desc" },
    });
  }
  return db.message.findMany({
    take: PAGE_SIZE,
    where: { channelId },
    select: selectFields,
    orderBy: { createdAt: "desc" },
  });
}

export function getMessage(messageId: string, channelId: string) {
  return db.message.findFirst({
    where: {
      id: messageId,
      channelId,
    },
    select: {
      id: true,
      content: true,
      type: true,
      fileUrl: true,
      fileKey: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      fileWidth: true,
      fileHeight: true,
      channelId: true,
      deleted: true,
      createdAt: true,
      updatedAt: true,
      member: {
        select: {
          id: true,
          role: true,
          profile: {
            select: profileSelect,
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
            select: profileSelect,
          },
        },
      },
    },
  });
}

export function updateMessageContent(messageId: string, content: string) {
  return db.message.update({
    where: { id: messageId },
    data: { content },
    select: {
      id: true,
      content: true,
      type: true,
      fileUrl: true,
      fileKey: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      fileWidth: true,
      fileHeight: true,
      channelId: true,
      deleted: true,
      createdAt: true,
      updatedAt: true,
      member: {
        select: {
          id: true,
          role: true,
          profile: {
            select: profileSelect,
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
            select: profileSelect,
          },
        },
      },
    },
  });
}

export function softDeleteMessage(messageId: string) {
  return db.message.update({
    where: { id: messageId },
    data: {
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      fileWidth: null,
      fileHeight: null,
      content: "This message has been deleted.",
      deleted: true,
    },
    select: {
      id: true,
      content: true,
      type: true,
      fileUrl: true,
      fileKey: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      fileWidth: true,
      fileHeight: true,
      channelId: true,
      deleted: true,
      createdAt: true,
      updatedAt: true,
      member: {
        select: {
          id: true,
          role: true,
          profile: {
            select: profileSelect,
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
            select: profileSelect,
          },
        },
      },
    },
  });
}

export function hardDeleteMessage(messageId: string) {
  return db.message.delete({
    where: { id: messageId },
  });
}
