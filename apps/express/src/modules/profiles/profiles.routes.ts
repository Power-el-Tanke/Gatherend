import { Router } from "express";
import { getProfileCard } from "./profiles.service.js";
import { logger } from "../../lib/logger.js";

const router = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET /profiles/:profileId/card → Datos para UserAvatarMenu

router.get("/:profileId/card", async (req, res) => {
  try {
    const { profileId } = req.params;
    const requestingProfileId = req.profile?.id;

    if (!requestingProfileId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!profileId || !UUID_REGEX.test(profileId)) {
      return res.status(400).json({ error: "Invalid profile ID" });
    }

    const profile = await getProfileCard(profileId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json(profile);
  } catch (error) {
    logger.error("[PROFILE_CARD_GET]", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
