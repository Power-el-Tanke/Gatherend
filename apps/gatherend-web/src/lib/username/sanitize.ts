/**
 * Sanitiza un username para que solo contenga caracteres válidos
 * Remueve espacios y caracteres especiales, mantiene letras, números y guión bajo
 *
 * NOTA: La validación de longitud mínima/máxima debe hacerse en el endpoint
 */
export function sanitizeUsername(username: string): string {
  return username
    .trim()
    .replace(/\s+/g, "") // Eliminar todos los espacios
    .replace(/[^a-zA-Z0-9_]/g, ""); // Solo letras, números y guión bajo
}
