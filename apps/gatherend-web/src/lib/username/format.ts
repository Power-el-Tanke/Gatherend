/**
 * Formatea el username completo con discriminante
 * Ejemplo: "Alejandro/ax3"
 */
export function formatFullUsername(
  username: string,
  discriminator: string,
): string {
  return `${username}/${discriminator}`;
}

/**
 * Parsea un username completo y devuelve sus partes
 * Ejemplo: "Alejandro/ax3" -> { username: "Alejandro", discriminator: "ax3" }
 */
export function parseFullUsername(fullUsername: string): {
  username: string;
  discriminator: string;
} | null {
  const parts = fullUsername.split("/");
  if (parts.length !== 2) {
    return null;
  }
  return {
    username: parts[0],
    discriminator: parts[1],
  };
}
