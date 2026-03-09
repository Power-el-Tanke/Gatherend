import { Position } from "./polygon";

export function circleRing(count: number, radius: number): Position[] {
  const step = (2 * Math.PI) / count;

  return Array.from({ length: count }, (_, i) => {
    const angle = i * step;

    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    };
  });
}
