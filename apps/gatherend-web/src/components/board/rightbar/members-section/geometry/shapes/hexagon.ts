import { buildPolygonRing, Position } from "./polygon";

export function hexagonRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 6, radius);
}
