"use client";

import { memo, useMemo } from "react";
import { Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_USERNAME_COLOR } from "@/lib/theme/presets";
import { GradientSlider } from "@/components/ui/gradient-slider";
import type { UsernameColorSectionProps, UsernameColor } from "./types";

// Helper to get display color/gradient for preview
const getColorPreviewStyle = (color: UsernameColor): React.CSSProperties => {
  if (!color) return { backgroundColor: DEFAULT_USERNAME_COLOR };
  if (color.type === "solid") {
    return { backgroundColor: color.color };
  }
  if (color.type === "gradient") {
    const stops = color.colors
      .map((c) => `${c.color} ${c.position}%`)
      .join(", ");
    return {
      background: `linear-gradient(${color.angle}deg, ${stops})`,
    };
  }
  return { backgroundColor: DEFAULT_USERNAME_COLOR };
};

export const UsernameColorSection = memo(function UsernameColorSection({
  colorState,
  colorActions,
  isSaving,
  t,
}: UsernameColorSectionProps) {
  // Build the current color for preview
  const currentColor: UsernameColor = useMemo(() => {
    if (colorState.mode === "gradient") {
      return {
        type: "gradient",
        colors: colorState.gradientColors,
        angle: colorState.gradientAngle,
        animated: colorState.gradientAnimated,
        animationType: colorState.gradientAnimated
          ? colorState.animationType
          : undefined,
      };
    }
    return { type: "solid", color: colorState.solidColor };
  }, [colorState]);

  const selectedColor =
    colorState.selectedGradientIndex !== null
      ? colorState.gradientColors[colorState.selectedGradientIndex]
      : null;

  return (
    <div className="space-y-2">
      <span
        id="username-color-label"
        className="uppercase text-xs font-bold text-theme-text-subtle block"
      >
        {t.profile.color}
      </span>

      {/* Toggle Gradient Mode */}
      <div
        className="flex items-center gap-2 mb-2"
        role="group"
        aria-labelledby="username-color-label"
      >
        <button
          type="button"
          onClick={() => colorActions.setMode("solid")}
          disabled={isSaving}
          className={cn(
            "px-3 py-1 text-xs rounded-l-md transition-colors cursor-pointer",
            colorState.mode === "solid"
              ? "bg-theme-tab-button-bg text-white"
              : "bg-theme-bg-input text-theme-text-subtle hover:bg-theme-bg-secondary",
          )}
          aria-pressed={colorState.mode === "solid"}
        >
          Sólido
        </button>
        <button
          type="button"
          onClick={() => colorActions.setMode("gradient")}
          disabled={isSaving}
          className={cn(
            "px-3 py-1 text-xs rounded-r-md transition-colors cursor-pointer",
            colorState.mode === "gradient"
              ? "bg-theme-tab-button-bg text-white"
              : "bg-theme-bg-input text-theme-text-subtle hover:bg-theme-bg-secondary",
          )}
          aria-pressed={colorState.mode === "gradient"}
        >
          Gradiente
        </button>
      </div>

      {/* Preview */}
      <div
        className="w-full h-8 rounded border border-theme-border-secondary mb-2"
        style={getColorPreviewStyle(currentColor)}
      />

      {colorState.mode === "solid" ? (
        /* Solid Color Picker */
        <div className="flex items-center gap-2">
          <label htmlFor="username-solid-color" className="sr-only">
            Color sólido
          </label>
          <div
            className="w-12 h-10 rounded border border-theme-border-secondary overflow-hidden cursor-pointer relative shrink-0"
            style={{ backgroundColor: colorState.solidColor }}
          >
            <input
              id="username-solid-color-picker"
              name="username-solid-color-picker"
              type="color"
              value={colorState.solidColor}
              onChange={(e) => colorActions.setSolidColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isSaving}
              aria-label="Selector de color"
            />
          </div>
          <Input
            id="username-solid-color"
            name="username-solid-color"
            disabled={isSaving}
            className="bg-theme-bg-input border-0 focus-visible:ring-2 focus-visible:ring-theme-accent-primary text-theme-text-light font-mono uppercase"
            placeholder={DEFAULT_USERNAME_COLOR}
            value={colorState.solidColor}
            onChange={(e) => colorActions.setSolidColor(e.target.value)}
          />
        </div>
      ) : (
        /* Gradient Editor with GradientSlider */
        <div className="space-y-3">
          {/* Gradient Slider - Drag handles on the bar */}
          <GradientSlider
            colors={colorState.gradientColors}
            onChange={colorActions.setGradientColors}
            onColorClick={(index) => colorActions.setSelectedIndex(index)}
            angle={colorState.gradientAngle}
            minColors={2}
            maxColors={4}
          />

          {/* Selected Color Editor */}
          {selectedColor && (
            <div className="flex items-center gap-2 p-2 bg-theme-bg-secondary rounded border border-theme-border-secondary">
              <div
                className="w-8 h-8 rounded border border-theme-border-secondary overflow-hidden cursor-pointer relative shrink-0"
                style={{ backgroundColor: selectedColor.color }}
              >
                <input
                  id="username-gradient-color-picker"
                  name="username-gradient-color-picker"
                  type="color"
                  value={selectedColor.color}
                  onChange={(e) =>
                    colorActions.updateSelectedColor(e.target.value)
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isSaving}
                  aria-label="Selector de color para gradiente"
                />
              </div>
              <Input
                id="username-gradient-color-hex"
                name="username-gradient-color-hex"
                disabled={isSaving}
                className="bg-theme-bg-input border-0 text-theme-text-light font-mono uppercase text-xs h-8 flex-1"
                value={selectedColor.color}
                onChange={(e) =>
                  colorActions.updateSelectedColor(e.target.value)
                }
              />
              <span className="text-xs text-theme-text-muted">
                {selectedColor.position}%
              </span>
              {colorState.gradientColors.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={colorActions.removeSelectedColor}
                  disabled={isSaving}
                  className="h-6 w-6 p-0 text-theme-text-muted hover:text-red-400"
                >
                  <Minus className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {/* Angle */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="username-gradient-angle"
              className="text-xs text-theme-text-subtle w-12"
            >
              Angle:
            </label>
            <input
              id="username-gradient-angle"
              name="username-gradient-angle"
              type="range"
              min="0"
              max="360"
              value={colorState.gradientAngle}
              onChange={(e) =>
                colorActions.setGradientAngle(parseInt(e.target.value))
              }
              className="flex-1 h-2 bg-theme-bg-input rounded-lg appearance-none cursor-pointer accent-theme-accent-primary"
              disabled={isSaving}
              aria-label="Ángulo del gradiente"
            />
            <span className="text-xs text-theme-text-muted w-10">
              {colorState.gradientAngle}°
            </span>
          </div>

          {/* Animation toggle */}
          <div className="pt-2 border-t border-theme-border-secondary/50">
            <button
              type="button"
              onClick={() => {
                const newValue = !colorState.gradientAnimated;
                colorActions.setGradientAnimated(newValue);
                // Always use "shift" animation when enabling
                if (newValue) {
                  colorActions.setAnimationType("shift");
                }
              }}
              disabled={isSaving}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
                colorState.gradientAnimated
                  ? "bg-theme-tab-button-bg text-white"
                  : "bg-theme-bg-input text-theme-text-subtle hover:bg-theme-bg-secondary",
              )}
            >
              Animar gradiente al pasar el mouse
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
