export type PlaceholderStrategy = "default";

export interface PlaceholderSpecOptions {
  compact: boolean;
  fontSizePx: number;
  windowHeightPx: number;
  groupSpacingPx: number;
  strategy: PlaceholderStrategy;
}

export interface PlaceholderSpecs {
  totalHeightPx: number;
  multiplier: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

/**
 * Heuristic placeholder height generator used for the top/bottom skeleton block.
 *
 * Important: callers use `totalHeightPx` both to render the skeleton AND to
 * normalize scrollTop/scrollHeight (store values are "minus placeholderHeight").
 * So this function must be stable and deterministic for a given environment.
 */
export function generateChatPlaceholderSpecs(
  options: PlaceholderSpecOptions,
): PlaceholderSpecs {
  const windowHeightPx = Math.max(0, options.windowHeightPx || 0);

  // Keep compact smaller.
  const multiplier = options.compact ? 1.35 : 1.6;

  // Avoid absurd values.
  const minPx = Math.max(240, options.fontSizePx * 20);
  const maxPx = 2600;

  const raw = windowHeightPx * multiplier;

  // Helps reduce jitter from fractional layout/zoom.
  const totalHeightPx = roundToHalf(clamp(raw, minPx, maxPx));

  return { totalHeightPx, multiplier };
}
