import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const DISCRIMINATOR_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const MAX_RANDOM_ATTEMPTS = 10;

// 36^3 = 46,656 combinaciones posibles de discriminator [a-z0-9]
export const MAX_DISCRIMINATORS = 46656;

/**
 * Genera un discriminator aleatorio de 3 caracteres [a-z0-9]
 */
function generateRandomDiscriminator(): string {
  let discriminator = "";
  for (let i = 0; i < 3; i++) {
    discriminator += DISCRIMINATOR_CHARS.charAt(
      Math.floor(Math.random() * DISCRIMINATOR_CHARS.length),
    );
  }
  return discriminator;
}

/**
 * Verifica si un discriminator está disponible para un username
 * Usa findFirst con mode insensitive porque los usernames preservan case en display
 * pero deben ser únicos case-insensitively (alejandro == Alejandro)
 */
export async function isDiscriminatorAvailable(
  username: string,
  discriminator: string,
): Promise<boolean> {
  const existing = await db.profile.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      discriminator,
    },
    select: { id: true },
  });
  return !existing;
}

/**
 * Genera un discriminator único usando búsqueda exhaustiva con PostgreSQL
 * Solo se llama cuando los intentos aleatorios fallan (username muy popular)
 */
async function generateDiscriminatorExhaustive(
  username: string,
): Promise<string> {
  logger.server("[DISCRIMINATOR] Using exhaustive SQL search for:", username);

  const result = await db.$queryRaw<{ disc: string }[]>`
    WITH all_discs AS (
      SELECT
        (
          CASE 
            WHEN (n / 1296) < 26 
              THEN chr(97 + (n / 1296))
            ELSE chr(48 + ((n / 1296) - 26))
          END
        ) ||
        (
          CASE 
            WHEN ((n % 1296) / 36) < 26 
              THEN chr(97 + ((n % 1296) / 36))
            ELSE chr(48 + (((n % 1296) / 36) - 26))
          END
        ) ||
        (
          CASE 
            WHEN (n % 36) < 26 
              THEN chr(97 + (n % 36))
            ELSE chr(48 + ((n % 36) - 26))
          END
        ) AS disc
      FROM generate_series(0, 46655) AS n
    )
    SELECT disc
    FROM all_discs
    WHERE disc NOT IN (
      SELECT discriminator
      FROM "Profile"
      WHERE LOWER(username) = LOWER(${username})
    )
    ORDER BY RANDOM()
    LIMIT 1
  `;

  if (!result.length) {
    throw new Error(
      `Username "${username}" has exhausted all 46,656 discriminators`,
    );
  }

  logger.server("[DISCRIMINATOR] Exhaustive search found:", result[0].disc);
  return result[0].disc;
}

/**
 * Genera un discriminante único de 3 caracteres [a-z0-9] para un username específico
 *
 * Algoritmo híbrido:
 * 1. Intenta 10 veces con discriminators aleatorios (rápido para 99% de casos)
 * 2. Si falla, usa búsqueda exhaustiva con PostgreSQL (garantizado si hay libres)
 */
export async function generateUniqueDiscriminator(
  username: string,
): Promise<string> {
  logger.server("[DISCRIMINATOR] Starting generation for username:", username);

  // FASE 1: Intentos aleatorios (rápido)
  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
    const discriminator = generateRandomDiscriminator();
    logger.server(
      "[DISCRIMINATOR] Attempt",
      attempt + 1,
      "- Generated:",
      discriminator,
    );

    const available = await isDiscriminatorAvailable(username, discriminator);

    if (available) {
      logger.server(
        "[DISCRIMINATOR] Found available discriminator:",
        discriminator,
        "for username:",
        username,
      );
      return discriminator;
    }

    logger.server("[DISCRIMINATOR] Combination exists, trying again...");
  }

  // FASE 2: Búsqueda exhaustiva (fallback garantizado)
  logger.server(
    "[DISCRIMINATOR] Random attempts exhausted, using exhaustive search...",
  );
  return generateDiscriminatorExhaustive(username);
}
