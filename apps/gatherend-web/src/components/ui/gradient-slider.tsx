"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

// Re-export from root types for convenience
export type { GradientColorStop } from "../../../types";
import type { GradientColorStop } from "../../../types";

interface GradientSliderProps {
  colors: GradientColorStop[];
  onChange: (colors: GradientColorStop[]) => void;
  onColorClick?: (index: number) => void;
  selectedIndex?: number | null;
  onSelectedIndexChange?: (index: number | null) => void;
  angle?: number;
  type?: "linear" | "radial";
  className?: string;
  minColors?: number;
  maxColors?: number;
  allowAdd?: boolean;
}

/**
 * Gradient Slider Component
 * Un slider visual donde los colores son handles arrastrables sobre la barra del gradiente.
 * Similar a los editores de gradiente de Photoshop/Figma.
 */
export function GradientSlider({
  colors,
  onChange,
  onColorClick,
  selectedIndex: selectedIndexProp,
  onSelectedIndexChange,
  angle: _angle = 90,
  type = "linear",
  className,
  minColors: _minColors = 2,
  maxColors = 4,
  allowAdd = true,
}: GradientSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<
    number | null
  >(null);

  const selectedIndex =
    selectedIndexProp === undefined ? internalSelectedIndex : selectedIndexProp;

  const setSelectedIndex = useCallback(
    (index: number | null) => {
      if (selectedIndexProp === undefined) {
        setInternalSelectedIndex(index);
      }
      onSelectedIndexChange?.(index);
    },
    [onSelectedIndexChange, selectedIndexProp],
  );

  // Generar CSS del gradiente para el fondo del track
  const gradientCSS = (() => {
    const sortedColors = [...colors].sort((a, b) => a.position - b.position);
    const stops = sortedColors
      .map((c) => `${c.color} ${c.position}%`)
      .join(", ");

    if (type === "radial") {
      return `linear-gradient(90deg, ${stops})`; // Para el slider siempre mostramos lineal horizontal
    }
    return `linear-gradient(90deg, ${stops})`;
  })();

  // Calcular posición del mouse relativa al track (0-100)
  const getPositionFromEvent = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    // Clamp entre 0 y 100
    return Math.max(0, Math.min(100, Math.round(percentage)));
  }, []);

  // Manejar inicio de drag
  const handleMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(index);
      setSelectedIndex(index);
    },
    [setSelectedIndex],
  );

  // Manejar movimiento durante drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingIndex === null) return;

      const newPosition = getPositionFromEvent(e.clientX);
      const newColors = [...colors];
      newColors[draggingIndex] = {
        ...newColors[draggingIndex],
        position: newPosition,
      };
      onChange(newColors);
    },
    [draggingIndex, colors, onChange, getPositionFromEvent],
  );

  // Manejar fin de drag
  const handleMouseUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  // Event listeners globales para drag
  useEffect(() => {
    if (draggingIndex !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingIndex, handleMouseMove, handleMouseUp]);

  // Manejar click en el track para añadir un nuevo color
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!allowAdd) return;
      if (colors.length >= maxColors) return;
      if (draggingIndex !== null) return; // No añadir si estamos arrastrando

      const position = getPositionFromEvent(e.clientX);

      // Encontrar los dos colores más cercanos para interpolar
      const sortedColors = [...colors].sort((a, b) => a.position - b.position);
      let leftColor = sortedColors[0];
      let rightColor = sortedColors[sortedColors.length - 1];

      for (let i = 0; i < sortedColors.length - 1; i++) {
        if (
          sortedColors[i].position <= position &&
          sortedColors[i + 1].position >= position
        ) {
          leftColor = sortedColors[i];
          rightColor = sortedColors[i + 1];
          break;
        }
      }

      // Interpolar color (simple promedio por ahora)
      const newColor = interpolateColor(
        leftColor.color,
        rightColor.color,
        (position - leftColor.position) /
          (rightColor.position - leftColor.position || 1),
      );

      const newColors = [...colors, { color: newColor, position }];
      onChange(newColors);
      setSelectedIndex(newColors.length - 1);
    },
    [
      allowAdd,
      colors,
      maxColors,
      draggingIndex,
      onChange,
      getPositionFromEvent,
      setSelectedIndex,
    ],
  );

  // Manejar doble click en un handle para abrir el color picker
  const handleDoubleClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onColorClick?.(index);
    },
    [onColorClick],
  );

  // Manejar click simple en handle
  const handleHandleClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIndex(index);
      onColorClick?.(index);
    },
    [onColorClick, setSelectedIndex],
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Track del gradiente */}
      <div
        ref={trackRef}
        className={cn(
          "relative h-6 rounded-md border border-theme-border-secondary select-none",
          allowAdd ? "cursor-crosshair" : "cursor-default",
        )}
        style={{ background: gradientCSS }}
        onClick={handleTrackClick}
      >
        {/* Checkerboard pattern for transparency */}
        <div
          className="absolute inset-0 rounded-md -z-10"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #ccc 25%, transparent 25%),
              linear-gradient(-45deg, #ccc 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #ccc 75%),
              linear-gradient(-45deg, transparent 75%, #ccc 75%)
            `,
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
          }}
        />

        {/* Handles de colores */}
        {colors.map((stop, index) => (
          <div
            key={index}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-7 rounded-sm border-2 cursor-grab shadow-md transition-shadow",
              draggingIndex === index && "cursor-grabbing scale-110",
              selectedIndex === index
                ? "border-white ring-2 ring-theme-button-primary z-10"
                : "border-white/80 hover:border-white z-0",
            )}
            style={{
              left: `${stop.position}%`,
              backgroundColor: stop.color,
            }}
            onMouseDown={(e) => handleMouseDown(index, e)}
            onClick={(e) => handleHandleClick(index, e)}
            onDoubleClick={(e) => handleDoubleClick(index, e)}
            title={`${stop.color} @ ${stop.position}%`}
          ></div>
        ))}
      </div>

      {/* Hint text */}
      <p className="text-[10px] text-theme-text-muted text-center">
        {!allowAdd
          ? "Arrastra los colores para mover"
          : colors.length < maxColors
            ? "Click en la barra para añadir • Arrastra para mover"
            : "Arrastra los colores para mover"}
      </p>
    </div>
  );
}

/**
 * Interpola entre dos colores hex
 */
function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  if (!c1 || !c2) return color1;

  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);

  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
