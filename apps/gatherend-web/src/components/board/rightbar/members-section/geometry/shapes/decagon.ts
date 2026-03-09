import { buildPolygonRing, Position } from "./polygon";

export function decagonRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 10, radius);
}
