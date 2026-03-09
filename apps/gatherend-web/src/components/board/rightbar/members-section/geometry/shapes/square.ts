import { buildPolygonRing, Position } from "./polygon";

export function squareRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 4, radius);
}
