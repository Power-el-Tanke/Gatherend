import { buildPolygonRing, Position } from "./polygon";

export function triangleRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 3, radius);
}
