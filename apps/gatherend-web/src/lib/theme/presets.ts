import type { ThemePreset } from "./types";

/**
 * Presets de temas predefinidos
 * El usuario puede elegir uno de estos y se guardará solo el baseColor en DB
 */
export const THEME_PRESETS: ThemePreset[] = [
  // Default - Teal actual de la app
  { name: "Teal Ocean", baseColor: "#2E8376" },

  // Variaciones
  { name: "Deep Sea", baseColor: "#1B6B5A" },
  { name: "Forest", baseColor: "#2D5A3D" },
  { name: "Emerald", baseColor: "#10B981" },

  // Azules
  { name: "Ocean Blue", baseColor: "#3B82F6" },
  { name: "Midnight", baseColor: "#1E3A5F" },
  { name: "Sky", baseColor: "#0EA5E9" },

  // Púrpuras
  { name: "Lavender", baseColor: "#8B5CF6" },
  { name: "Purple Dream", baseColor: "#7C3AED" },
  { name: "Violet", baseColor: "#A855F7" },

  // Cálidos
  { name: "Sunset", baseColor: "#F97316" },
  { name: "Rose", baseColor: "#E11D48" },
  { name: "Coral", baseColor: "#FB7185" },
  { name: "Amber", baseColor: "#F59E0B" },

  // Neutros
  { name: "Slate", baseColor: "#64748B" },
  { name: "Zinc", baseColor: "#71717A" },
  { name: "Stone", baseColor: "#78716C" },
];

/** Color base por defecto (Teal actual) */
export const DEFAULT_BASE_COLOR = "#2E8376";

/** Color por defecto del username (gris suave en lugar de blanco puro) */
export const DEFAULT_USERNAME_COLOR = "#B5B5B5";

/** Presets de gradientes predefinidos */
export const GRADIENT_PRESETS = [
  {
    name: "Aurora",
    config: {
      colors: ["#1a1a2e", "#16213e", "#0f3460", "#1a1a2e"],
      angle: 135,
      type: "linear" as const,
    },
  },
  {
    name: "Sunset",
    config: {
      colors: ["#2D1B2E", "#4A2040", "#1B2A28"],
      angle: 180,
      type: "linear" as const,
    },
  },
  {
    name: "Ocean",
    config: {
      colors: ["#0F2027", "#203A43", "#2C5364"],
      angle: 135,
      type: "linear" as const,
    },
  },
  {
    name: "Forest",
    config: {
      colors: ["#1B2A28", "#2D3B29", "#1B2A28"],
      angle: 180,
      type: "linear" as const,
    },
  },
  {
    name: "Midnight",
    config: {
      colors: ["#0F0C29", "#302B63", "#24243E"],
      angle: 135,
      type: "linear" as const,
    },
  },
  {
    name: "Cosmic",
    config: {
      colors: ["#1A1A2E", "#4A148C", "#1A1A2E"],
      angle: 180,
      type: "radial" as const,
    },
  },
];
