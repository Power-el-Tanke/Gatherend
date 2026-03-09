import { Languages } from "@prisma/client";
import { logger } from "@/lib/logger";

// Convierte navigator.languages → ["ES"], ["EN"] o ["ES","EN"]
export function detectBoardLanguages(): Languages[] {
  if (typeof navigator === "undefined") return ["EN"]; // SSR fallback

  const langs = navigator.languages || [navigator.language];

  // Convertir todo a mayúsculas y ISO-2 básico ("es-PE" -> "ES")
  const normalized = langs
    .map((l) => l.split("-")[0].toUpperCase())
    .filter(Boolean);

  const hasES = normalized.includes("ES");
  const hasEN = normalized.includes("EN");

  if (hasES && hasEN) return ["ES", "EN"] as Languages[];

  if (hasES) return ["ES"] as Languages[];

  // Si no hay ES, pero al menos hay EN
  if (hasEN) return ["EN"] as Languages[];

  // Si NO hay ES ni EN → default to EN
  return ["EN"] as Languages[];
}

export function normalizeLanguages(input: string[] | undefined): Languages[] {
  try {
    if (!input || !Array.isArray(input) || input.length === 0) {
      return ["EN"];
    }

    const upper = input.map((l) => l.toUpperCase());

    const hasES = upper.includes("ES");
    const hasEN = upper.includes("EN");

    let result: Languages[];
    if (hasES && hasEN) {
      result = ["ES", "EN"];
    } else if (hasES) {
      result = ["ES"];
    } else {
      result = ["EN"];
    }

    return result;
  } catch (error) {
    logger.error("[NORMALIZE_LANGUAGES] Error:", error);
    return ["EN"];
  }
}
