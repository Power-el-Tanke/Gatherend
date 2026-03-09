/**
 * Web Worker para extracción de color dominante de imágenes.
 * Mueve el procesamiento pesado de canvas fuera del main thread.
 */

// Tipos para mensajes
interface ExtractColorMessage {
  type: "extractColor";
  imageData: ImageData;
  isDicebear: boolean;
}

type WorkerMessage = ExtractColorMessage;

interface ColorResult {
  type: "colorResult";
  color: string | null;
}

// Extraer color de esquina para imágenes Dicebear (fondo sólido)
function extractCornerColor(imageData: ImageData): string | null {
  const { data, width } = imageData;

  try {
    // Obtener pixel en posición (5, 5)
    const index = (5 * width + 5) * 4;
    let r = data[index];
    let g = data[index + 1];
    let b = data[index + 2];

    // Desaturar y oscurecer para el fondo
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const desaturationFactor = 0.4;
    r = Math.round(r + (gray - r) * desaturationFactor);
    g = Math.round(g + (gray - g) * desaturationFactor);
    b = Math.round(b + (gray - b) * desaturationFactor);

    const darkenFactor = 0.35;
    r = Math.round(r * darkenFactor);
    g = Math.round(g * darkenFactor);
    b = Math.round(b * darkenFactor);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

// Extraer color dominante para imágenes reales
function extractDominantColor(imageData: ImageData): string | null {
  const { data } = imageData;

  try {
    const colorMap = new Map<
      string,
      { count: number; r: number; g: number; b: number }
    >();
    const quantize = (v: number) => Math.floor(v / 8) * 8;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 128) continue;

      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 240) continue;

      const qr = quantize(r);
      const qg = quantize(g);
      const qb = quantize(b);
      const key = `${qr},${qg},${qb}`;

      const existing = colorMap.get(key);
      if (existing) {
        existing.count++;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        colorMap.set(key, { count: 1, r, g, b });
      }
    }

    let dominantColor = { count: 0, r: 0, g: 0, b: 0 };
    for (const color of colorMap.values()) {
      if (color.count > dominantColor.count) {
        dominantColor = color;
      }
    }

    if (dominantColor.count === 0) return null;

    let r = Math.round(dominantColor.r / dominantColor.count);
    let g = Math.round(dominantColor.g / dominantColor.count);
    let b = Math.round(dominantColor.b / dominantColor.count);

    // Desaturar y oscurecer
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const desaturationFactor = 0.4;
    r = Math.round(r + (gray - r) * desaturationFactor);
    g = Math.round(g + (gray - g) * desaturationFactor);
    b = Math.round(b + (gray - b) * desaturationFactor);

    const darkenFactor = 0.35;
    r = Math.round(r * darkenFactor);
    g = Math.round(g * darkenFactor);
    b = Math.round(b * darkenFactor);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

// Handler de mensajes
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, imageData, isDicebear } = event.data;

  if (type === "extractColor") {
    const color = isDicebear
      ? extractCornerColor(imageData)
      : extractDominantColor(imageData);

    const result: ColorResult = { type: "colorResult", color };
    self.postMessage(result);
  }
};

export {};
