// /geometry/get-member-positions.ts

import { SLOT_PRESETS } from "./presets";
import { composeRings } from "./compose-rings";
import { Position } from "./shapes/polygon";
import { logger } from "@/lib/logger";

export function getSlotPositions(totalSlots: number): {
  positions: Position[];
  avatarSize: number;
} {
  if (totalSlots <= 0) return { positions: [], avatarSize: 40 };

  if (totalSlots === 1) {
    return { positions: [{ x: 50, y: 50 }], avatarSize: 70 };
  }

  const preset = SLOT_PRESETS[totalSlots];

  if (!preset) {
    logger.warn(`No preset defined for ${totalSlots}`);
    return { positions: [{ x: 50, y: 50 }], avatarSize: 40 };
  }

  const positions = composeRings(preset.rings);

  return {
    positions,
    avatarSize: preset.avatarSize,
  };
}
