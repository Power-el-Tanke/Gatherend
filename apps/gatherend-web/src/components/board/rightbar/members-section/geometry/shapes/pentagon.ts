import { buildPolygonRing, Position } from "./polygon";

export function pentagonRing(count: number, radius: number): Position[] {
  return buildPolygonRing(count, 5, radius);
}
