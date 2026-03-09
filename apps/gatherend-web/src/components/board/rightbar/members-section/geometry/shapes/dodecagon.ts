import { buildPolygonRing, Position } from "./polygon";

export function dodecagonRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 12, radius);
}
