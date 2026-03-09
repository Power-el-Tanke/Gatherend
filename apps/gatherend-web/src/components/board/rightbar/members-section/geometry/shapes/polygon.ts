// /geometry/polygon.ts
// Funciones genéricas para generar posiciones en polígonos de n lados.

export interface Position {
  x: number; // porcentaje
  y: number; // porcentaje
}

/**
 * Genera las posiciones de los vértices de un polígono regular de "sides" lados.
 */
function buildPolygonVertices(
  sides: number,
  radius: number,
  rotationDeg: number = 0
): Position[] {
  const vertices: Position[] = [];
  const rotationRad = (rotationDeg * Math.PI) / 180;

  for (let i = 0; i < sides; i++) {
    // ángulo base + rotación adicional
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2 + rotationRad;

    vertices.push({
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    });
  }

  return vertices;
}

/**
 * Distribuye "count" miembros a lo largo del perímetro del polígono.
 * @param fewerSlotsSides - índices de los lados que deben tener MENOS slots (no reciben el remainder extra)
 */
export function buildPolygonRing(
  count: number,
  sides: number,
  radius: number,
  rotationDeg: number = 0,
  fewerSlotsSides?: number[]
): Position[] {
  const vertices = buildPolygonVertices(sides, radius, rotationDeg);

  // Si hay menos miembros que lados, solo tomamos los primeros vértices
  if (count <= sides) {
    return vertices.slice(0, count);
  }

  const positions: Position[] = [];

  // 1) Siempre colocar un miembro en cada vértice
  for (let i = 0; i < sides; i++) {
    positions.push(vertices[i]);
  }

  // Relleno restante
  const remaining = count - sides;

  // 2) Distribuir el resto a lo largo de los lados
  const extraPerSide = Math.floor(remaining / sides);
  const remainder = remaining % sides;

  // Determinar qué lados reciben el extra del remainder
  // Por defecto: los primeros 'remainder' lados (0, 1, 2...)
  // Con fewerSlotsSides: los lados NO listados reciben el extra
  const sidesWithExtra = new Set<number>();

  if (fewerSlotsSides && fewerSlotsSides.length > 0) {
    // Los lados que NO están en fewerSlotsSides reciben el extra
    for (let i = 0; i < sides; i++) {
      if (!fewerSlotsSides.includes(i) && sidesWithExtra.size < remainder) {
        sidesWithExtra.add(i);
      }
    }
  } else {
    // Comportamiento por defecto: primeros 'remainder' lados
    for (let i = 0; i < remainder; i++) {
      sidesWithExtra.add(i);
    }
  }

  for (let i = 0; i < sides; i++) {
    const start = vertices[i];
    const end = vertices[(i + 1) % sides];

    // cuántos puntos adicionales van en este lado
    const countOnSide = extraPerSide + (sidesWithExtra.has(i) ? 1 : 0);

    for (let step = 1; step <= countOnSide; step++) {
      const t = step / (countOnSide + 1); // evitar vértices
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      positions.push({ x, y });
    }
  }

  return positions;
}
