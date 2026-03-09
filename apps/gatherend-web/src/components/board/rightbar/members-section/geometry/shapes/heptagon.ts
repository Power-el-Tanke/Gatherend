import { buildPolygonRing, Position } from "./polygon";

export function heptagonRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 7, radius);
}
