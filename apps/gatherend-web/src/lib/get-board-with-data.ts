// lib/get-board-with-data.ts
import { db } from "@/lib/db";
import { cache } from "react";

/**
 * Obtiene board completo con datos relacionados
 * Usa React.cache() para deduplicación dentro del mismo request
 * (evita queries duplicadas en layout + page + mobile-toggle)
 */
export const getBoardWithData = cache(
  async (boardId: string, profileId: string) => {
    const board = await db.board.findFirst({
      where: {
        id: boardId,
        members: { some: { profileId } }, // Check de seguridad
      },
      include: {
        // Channels sin categoría (root level)
        channels: {
          where: { parentId: null },
          orderBy: { position: "asc" },
        },
        // Categorías con sus channels
        categories: {
          orderBy: { position: "asc" },
          include: {
            channels: {
              orderBy: { position: "asc" },
            },
          },
        },
        // Members con profile optimizado
        members: {
          orderBy: { role: "asc" },
          include: {
            profile: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                imageUrl: true,
                email: true,
                userId: true,
                usernameColor: true,
                profileTags: true,
                badge: true,
                badgeStickerUrl: true,
                usernameFormat: true,
                longDescription: true,
              },
            },
          },
        },
        // Slots con member y profile
        slots: {
          // orderBy: { slotNumber: "asc" }, // Removed as it doesn't exist
          include: {
            member: {
              include: {
                profile: {
                  select: {
                    id: true,
                    username: true,
                    discriminator: true,
                    imageUrl: true,
                    email: true,
                    userId: true,
                    usernameColor: true,
                    profileTags: true,
                    badge: true,
                    badgeStickerUrl: true,
                    usernameFormat: true,
                    longDescription: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return board;
  },
);

/**
 * Obtiene conversaciones del usuario
 * Usa React.cache() para deduplicación dentro del mismo request
 * Filtra las conversaciones que el usuario ha ocultado
 */
export const getConversationsForProfile = cache(async (profileId: string) => {
  const conversations = await db.conversation.findMany({
    where: {
      OR: [
        {
          profileOneId: profileId,
          hiddenByOneAt: null, // Solo mostrar si profileOne no la ha ocultado
        },
        {
          profileTwoId: profileId,
          hiddenByTwoAt: null, // Solo mostrar si profileTwo no la ha ocultado
        },
      ],
    },
    include: {
      profileOne: {
        select: {
          id: true,
          username: true,
          discriminator: true,
          imageUrl: true,
          email: true,
          userId: true,
        },
      },
      profileTwo: {
        select: {
          id: true,
          username: true,
          discriminator: true,
          imageUrl: true,
          email: true,
          userId: true,
        },
      },
      directMessages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          content: true,
          fileUrl: true,
          deleted: true,
          senderId: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return conversations;
});

/**
 * Obtiene todos los boards en los que está un usuario
 * Usa React.cache() para deduplicación dentro del mismo request
 */
export const getBoardsForSidebar = cache(async (profileId: string) => {
  const boards = await db.board.findMany({
    where: {
      members: {
        some: {
          profileId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      channels: {
        select: {
          id: true,
        },
      },
    },
  });
  return boards;
});
