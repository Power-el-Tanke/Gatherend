import { buildPolygonRing, Position } from "./polygon";

export function octagonRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 8, radius);
}
