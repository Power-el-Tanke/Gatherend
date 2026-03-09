/**
 * Feature Flags
 * Centraliza las features que pueden ser activadas/desactivadas
 */

export const FEATURES = {
  /**
   * Habilita las categorías en el sidebar de boards
   * Si es false, solo se muestran los canales en una lista vertical
   * Las categorías seguirán existiendo en la DB pero no serán accesibles
   */
  CATEGORIES_ENABLED: false,
} as const;
