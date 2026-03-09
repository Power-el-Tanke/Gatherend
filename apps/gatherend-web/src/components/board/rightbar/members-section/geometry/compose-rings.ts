// /geometry/compose-rings.ts

import {
  triangleRing,
  squareRing,
  pentagonRing,
  hexagonRing,
  circleRing,
  Position,
  buildPolygonRing,
} from "./shapes";
import { heptagonRing } from "./shapes/heptagon";

export interface RingConfig {
  count: number;
  sides: number; // 3,4,5,6 or 0 for circle
  radius: number;
  rotationDeg?: number; // optional rotation in degrees
  fewerSlotsSides?: number[]; // indices of sides that should have fewer slots (when remainder exists)
}

export function composeRing(rc: RingConfig): Position[] {
  // RING CIRCULAR
  if (rc.sides === 0) {
    return circleRing(rc.count, rc.radius);
  }

  // Si hay rotación custom o fewerSlotsSides, usar buildPolygonRing directamente
  if (rc.rotationDeg !== undefined || rc.fewerSlotsSides !== undefined) {
    return buildPolygonRing(
      rc.count,
      rc.sides,
      rc.radius,
      rc.rotationDeg ?? 0,
      rc.fewerSlotsSides
    );
  }

  // RINGS POLIGONALES (defaults)
  switch (rc.sides) {
    case 3:
      return triangleRing(rc.count, rc.radius);
    case 4:
      return squareRing(rc.count, rc.radius);
    case 5:
      return pentagonRing(rc.count, rc.radius);
    case 6:
      return hexagonRing(rc.count, rc.radius);
    case 7:
      return heptagonRing(rc.count, rc.radius);
    default:
      // fallback seguro → círculo
      return circleRing(rc.count, rc.radius);
  }
}

export function composeRings(list: RingConfig[]): Position[] {
  return list.flatMap((rc) => composeRing(rc));
}
