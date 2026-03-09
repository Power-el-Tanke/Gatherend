/**
 * Client-side ban check helper
 * Verifica si el usuario actual está baneado después de autenticarse
 */

import { fetchWithRetry } from "@/lib/fetch-with-retry";

/**
 * Verifica si el usuario autenticado está baneado.
 * Llama a la API para obtener el perfil y verificar el estado de ban.
 *
 * @returns { banned: boolean, banReason?: string } o null si hay error
 */
export async function checkUserBanStatus(): Promise<{
  banned: boolean;
  banReason?: string | null;
} | null> {
  try {
    const response = await fetchWithRetry("/api/profile/me", {
      method: "GET",
    });

    if (!response.ok) {
      // Si es 403, probablemente está baneado
      if (response.status === 403) {
        const data = await response.json();
        if (data.banned) {
          return { banned: true, banReason: data.banReason };
        }
      }
      return null;
    }

    const data = await response.json();
    return {
      banned: data.banned || false,
      banReason: data.banReason || null,
    };
  } catch {
    // En caso de error de red, permitir continuar
    // El middleware del servidor manejará la verificación
    return null;
  }
}
