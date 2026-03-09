import { db } from "../../lib/db.js";

export async function getAllStickers(profileId?: string) {
  return db.sticker.findMany({
    where: {
      OR: [
        // Default stickers (not custom)
        { isCustom: false },
        // User's own custom stickers
        ...(profileId ? [{ uploaderId: profileId, isCustom: true }] : []),
      ],
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function getStickersByCategory(
  category: string,
  profileId?: string
) {
  return db.sticker.findMany({
    where: {
      category,
      OR: [
        // Default stickers (not custom)
        { isCustom: false },
        // User's own custom stickers
        ...(profileId ? [{ uploaderId: profileId, isCustom: true }] : []),
      ],
    },
    orderBy: { name: "asc" },
  });
}

export async function getStickerById(id: string) {
  return db.sticker.findUnique({
    where: { id },
  });
}
