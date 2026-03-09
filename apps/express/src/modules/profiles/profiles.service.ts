import { db } from "../../lib/db.js";

// Campos para el ProfileCard (usado en UserAvatarMenu)
const profileCardSelect = {
  id: true,
  username: true,
  discriminator: true,
  imageUrl: true,
  usernameColor: true,
  profileTags: true,
  badge: true,
  badgeStickerUrl: true,
  usernameFormat: true,
  longDescription: true,
};

/**
 * Obtiene los datos de un perfil para mostrar en el UserAvatarMenu (ProfileCard)
 * Incluye todos los campos necesarios para el popover
 */
export async function getProfileCard(profileId: string) {
  return db.profile.findUnique({
    where: { id: profileId },
    select: profileCardSelect,
  });
}
