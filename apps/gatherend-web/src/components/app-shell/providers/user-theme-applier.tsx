"use client";

import { useEffect, useMemo } from "react";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import {
  applyGradientToDOM,
  applyThemeToDOM,
  applyTransparencyToBackgrounds,
  generateLightPaletteFromBase,
  generatePaletteFromBase,
  isValidHexColor,
  validateGradientConfig,
} from "@/lib/theme/utils";
import { DEFAULT_BASE_COLOR } from "@/lib/theme/presets";
import type { GradientConfig, ThemeConfig, ThemeMode } from "@/lib/theme/types";

function parseThemeConfig(config: unknown): ThemeConfig | null {
  if (!config || typeof config !== "object") return null;

  const c = config as Record<string, unknown>;
  const result: ThemeConfig = {};

  if (
    c.baseColor &&
    typeof c.baseColor === "string" &&
    isValidHexColor(c.baseColor)
  ) {
    result.baseColor = c.baseColor;
  }

  if (c.gradient && validateGradientConfig(c.gradient)) {
    result.gradient = c.gradient as GradientConfig;
  }

  if (c.mode === "dark" || c.mode === "light") {
    result.mode = c.mode as ThemeMode;
  }

  return result;
}

/**
 * Applies the current user's theme to the DOM.
 *
 * This is intentionally isolated from AppShell so changes in session/profile/theme
 * don't force a render of the layout chrome.
 */
export function UserThemeApplier() {
  const profile = useProfile();

  // themeConfig can be a JSON object; stringify makes dependency comparisons stable.
  const themeConfigKey = JSON.stringify(profile.themeConfig || null);

  const themeConfig = useMemo(
    () => parseThemeConfig(profile.themeConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeConfigKey],
  );

  const baseColor = themeConfig?.baseColor || DEFAULT_BASE_COLOR;
  const mode: ThemeMode = themeConfig?.mode || "dark";
  const hasGradient = !!themeConfig?.gradient;

  useEffect(() => {
    let colors =
      mode === "light"
        ? generateLightPaletteFromBase(baseColor)
        : generatePaletteFromBase(baseColor);

    if (themeConfig?.gradient) {
      colors = applyTransparencyToBackgrounds(colors);
    }

    applyThemeToDOM(colors);
    applyGradientToDOM(themeConfig?.gradient || null);
  }, [baseColor, mode, themeConfigKey, themeConfig?.gradient, hasGradient]);

  return null;
}
