// /geometry/presets.ts
import { RingConfig } from "./compose-rings";

/**
 *
 * PRESETS PARA TODOS LOS TOTAL MEMBERS DEL 1 AL 49
 *
 * El centro SIEMPRE se agrega automáticamente como:
 *      { count: 1, sides: 0, radius: 0 }
 *
 * A partir de 26 todos usan sides: 0 (círculos) para optimizar espacio
 */

export interface SlotPresets {
  avatarSize: number;
  rings: RingConfig[];
}

export const SLOT_PRESETS: Record<number, SlotPresets> = {
  1: {
    avatarSize: 20,
    rings: [{ count: 1, sides: 0, radius: 0 }],
  },

  2: {
    avatarSize: 14,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 2, sides: 2, radius: 34 },
    ],
  },

  3: {
    avatarSize: 14,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 2, sides: 2, radius: 34 },
    ],
  },

  4: {
    avatarSize: 14,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 3, sides: 3, radius: 34 },
    ],
  },

  5: {
    avatarSize: 14,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 34 },
    ],
  },

  6: {
    avatarSize: 14,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 5, sides: 5, radius: 34 },
    ],
  },

  7: {
    avatarSize: 14,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 6, sides: 6, radius: 34 },
    ],
  },

  8: {
    avatarSize: 14,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 7, sides: 7, radius: 34 },
    ],
  },

  9: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 3, sides: 3, radius: 21 },
      { count: 5, sides: 0, radius: 40 },
    ],
  },

  10: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 3, sides: 3, radius: 21 },
      { count: 6, sides: 0, radius: 40 },
    ],
  },

  11: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 21 },
      { count: 6, sides: 0, radius: 40 },
    ],
  },

  12: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 3, sides: 3, radius: 21 },
      { count: 8, sides: 0, radius: 40 },
    ],
  },

  13: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 21 },
      { count: 8, sides: 0, radius: 40 },
    ],
  },

  14: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 5, sides: 5, radius: 21 },
      { count: 8, sides: 0, radius: 40 },
    ],
  },

  15: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 3, sides: 3, radius: 21 },
      { count: 11, sides: 0, radius: 40 },
    ],
  },

  16: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 21 },
      { count: 11, sides: 0, radius: 40 },
    ],
  },

  17: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 5, sides: 5, radius: 21 },
      { count: 11, sides: 0, radius: 40 },
    ],
  },

  18: {
    avatarSize: 10,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 6, sides: 6, radius: 21 },
      { count: 11, sides: 0, radius: 40 },
    ],
  },

  19: {
    avatarSize: 9,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 7, sides: 7, radius: 21 },
      { count: 11, sides: 0, radius: 40 },
    ],
  },

  20: {
    avatarSize: 9,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 6, sides: 6, radius: 21 },
      { count: 13, sides: 0, radius: 40 },
    ],
  },

  21: {
    avatarSize: 9,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 7, sides: 7, radius: 21 },
      { count: 13, sides: 0, radius: 40 },
    ],
  },

  22: {
    avatarSize: 9,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 6, sides: 6, radius: 21 },
      { count: 14, sides: 0, radius: 40 },
    ],
  },

  23: {
    avatarSize: 9,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 7, sides: 7, radius: 21 },
      { count: 14, sides: 0, radius: 40 },
    ],
  },

  24: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 7, sides: 7, radius: 21 },
      { count: 16, sides: 0, radius: 40 },
    ],
  },

  25: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 24.5 },
      { count: 16, sides: 0, radius: 40 },
    ],
  },

  //  3 RINGS (26-30) - Patrón similar al caso 25

  26: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 24.5 },
      { count: 17, sides: 0, radius: 40 },
    ],
  },

  27: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 10, sides: 5, radius: 24.5 },
      { count: 16, sides: 0, radius: 40 },
    ],
  },

  28: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 10, sides: 5, radius: 24.5 },
      { count: 17, sides: 0, radius: 40 },
    ],
  },

  29: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 10, sides: 5, radius: 24.5 },
      { count: 18, sides: 0, radius: 40 },
    ],
  },

  30: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 18, rotationDeg: 45 },
      { count: 8, sides: 4, radius: 35, rotationDeg: 45 },
      {
        count: 17,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 1, 2],
      },
    ],
  },

  //  4 RINGS (31-49) - Patrón cuadrado como caso 50

  31: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 18, rotationDeg: 45 },
      { count: 8, sides: 4, radius: 35, rotationDeg: 45 },
      {
        count: 18,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [1, 3],
      },
    ],
  },

  32: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 18, rotationDeg: 45 },
      { count: 8, sides: 4, radius: 35, rotationDeg: 45 },
      { count: 19, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  33: {
    avatarSize: 8,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 18, rotationDeg: 45 },
      { count: 8, sides: 4, radius: 35, rotationDeg: 45 },
      { count: 20, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  34: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 18, rotationDeg: 45 },
      { count: 8, sides: 4, radius: 35, rotationDeg: 45 },
      {
        count: 21,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 1, 2],
      },
    ],
  },

  35: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 4, sides: 4, radius: 16, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 37, rotationDeg: 45 },
      {
        count: 18,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 2],
      },
    ],
  },

  36: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 8, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 19, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  37: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 16, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  38: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      {
        count: 17,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 1, 2],
      },
    ],
  },

  39: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      {
        count: 18,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 2],
      },
    ],
  },

  40: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 19, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  41: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 20, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  42: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      {
        count: 21,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 1, 2],
      },
    ],
  },

  43: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      {
        count: 22,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 2],
      },
    ],
  },

  44: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 23, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  45: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 12, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 24, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  46: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 16, sides: 4, radius: 38.5, rotationDeg: 45 },
      {
        count: 21,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 1, 2],
      },
    ],
  },

  47: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 16, sides: 4, radius: 38.5, rotationDeg: 45 },
      {
        count: 22,
        sides: 4,
        radius: 57,
        rotationDeg: 45,
        fewerSlotsSides: [0, 2],
      },
    ],
  },

  48: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 16, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 23, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },

  49: {
    avatarSize: 7,
    rings: [
      { count: 1, sides: 0, radius: 0 },
      { count: 8, sides: 4, radius: 20, rotationDeg: 45 },
      { count: 16, sides: 4, radius: 38.5, rotationDeg: 45 },
      { count: 24, sides: 4, radius: 57, rotationDeg: 45 },
    ],
  },
};
