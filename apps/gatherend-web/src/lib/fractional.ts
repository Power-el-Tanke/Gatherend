export function fractional(prev: number | null, next: number | null) {
  if (prev === null && next === null) {
    return 1000; // lista vacía
  }
  if (prev === null) return next! - 1000; // mover al inicio
  if (next === null) return prev + 1000; // mover al final
  return (prev + next) / 2; // mover entre dos
}
