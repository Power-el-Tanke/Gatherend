"use client";

import { useEffect, useMemo } from "react";
import { useCurrentProfile } from "./use-current-profile";
import {
  generatePaletteFromBase,
  generateLightPaletteFromBase,
  applyThemeToDOM,
  applyGradientToDOM,
  applyTransparencyToBackgrounds,
  validateGradientConfig,
  isValidHexColor,
} from "@/lib/theme/utils";
import { DEFAULT_BASE_COLOR } from "@/lib/theme/presets";
import type { ThemeConfig, GradientConfig, ThemeMode } from "@/lib/theme/types";

/**
 * Valida la estructura del themeConfig
 */
function parseThemeConfig(config: unknown): ThemeConfig | null {
  if (!config || typeof config !== "object") return null;

  const c = config as Record<string, unknown>;
  const result: ThemeConfig = {};

  // Validar baseColor si existe
  if (
    c.baseColor &&
    typeof c.baseColor === "string" &&
    isValidHexColor(c.baseColor)
  ) {
    result.baseColor = c.baseColor;
  }

  // Validar gradient si existe
  if (c.gradient && validateGradientConfig(c.gradient)) {
    result.gradient = c.gradient as GradientConfig;
  }

  // Validar mode si existe
  if (c.mode === "dark" || c.mode === "light") {
    result.mode = c.mode as ThemeMode;
  }

  return result;
}

/**
 * Hook que carga y aplica el tema del usuario actual
 * Inyecta las variables CSS al DOM basándose en el perfil del usuario
 */
export function useUserTheme() {
  const { data: profile, isLoading, dataUpdatedAt } = useCurrentProfile();

  // Serializar themeConfig para detectar cambios (objetos JSON)
  const themeConfigKey = JSON.stringify(profile?.themeConfig || null);

  // Parsear themeConfig del perfil
  const themeConfig = useMemo(
    () => parseThemeConfig(profile?.themeConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeConfigKey] // Usar key serializada para detectar cambios en objetos
  );

  // Calcular valores derivados
  const baseColor = themeConfig?.baseColor || DEFAULT_BASE_COLOR;
  const hasGradient = !!themeConfig?.gradient;
  const mode: ThemeMode = themeConfig?.mode || "dark";

  useEffect(() => {
    // No aplicar si todavía está cargando
    if (isLoading) return;

    // Generar paleta según el modo (dark o light)
    let colors =
      mode === "light"
        ? generateLightPaletteFromBase(baseColor)
        : generatePaletteFromBase(baseColor);

    // Si hay degradado activo, aplicar transparencia a los fondos
    if (themeConfig?.gradient) {
      colors = applyTransparencyToBackgrounds(colors);
    }

    // Aplicar colores al DOM
    applyThemeToDOM(colors);

    // Aplicar gradiente si existe
    applyGradientToDOM(themeConfig?.gradient || null);

    // Log para debugging
  }, [
    baseColor,
    mode,
    themeConfigKey,
    isLoading,
    themeConfig?.gradient,
    hasGradient,
    dataUpdatedAt,
  ]);

  return {
    isLoading,
    baseColor,
    mode,
    hasGradient,
    themeConfig,
  };
}
