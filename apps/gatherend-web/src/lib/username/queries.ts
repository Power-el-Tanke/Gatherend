import { db } from "@/lib/db";
import { parseFullUsername } from "./format";

/**
 * Busca un perfil por username completo (username/discriminator)
 */
export async function findProfileByFullUsername(fullUsername: string) {
  const parsed = parseFullUsername(fullUsername);
  if (!parsed) {
    return null;
  }

  return await db.profile.findFirst({
    where: {
      username: { equals: parsed.username, mode: "insensitive" },
      discriminator: parsed.discriminator,
    },
  });
}

/**
 * Busca perfiles por username base (sin discriminador)
 * Útil para mostrar sugerencias al usuario
 */
export async function findProfilesByUsername(
  username: string,
  limit: number = 10,
) {
  return await db.profile.findMany({
    where: {
      username: {
        contains: username,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
      discriminator: true,
      imageUrl: true,
    },
    take: limit,
  });
}
