"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketClient } from "@/components/providers/socket-provider";
import {
  applyProfilePatchToAllCaches,
  type ProfilePatch,
} from "./profile-patch-utils";
import { getTrackedProfileIds } from "./use-profile-room-subscriptions";
import axios from "axios";

// Sync profiles from server after reconnection
async function syncProfilesOnReconnect(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const ids = getTrackedProfileIds();
  if (ids.length === 0) return;

  try {
    const { data: profiles } = await axios.post("/api/profiles/batch", { ids });
    if (!Array.isArray(profiles)) return;

    for (const profile of profiles) {
      if (typeof profile?.id !== "string") continue;
      applyProfilePatchToAllCaches(queryClient, profile.id, profile);
    }
  } catch {
    // This catch is not critical, stale profiles will update on next socket event
  }
}

export function useProfileUpdatesSocket() {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();
  const hasConnectedBefore = useRef(false);

  useEffect(() => {
    if (!socket) return;

    const handleProfileUpdated = (payload: any) => {
      const profileId = payload?.profileId;
      const patch = payload?.patch as ProfilePatch | undefined;
      if (typeof profileId !== "string" || !profileId) return;
      if (!patch || typeof patch !== "object") return;

      applyProfilePatchToAllCaches(queryClient, profileId, patch);
    };

    const handleConnect = () => {
      // Skip initial connection, only sync on reconnections
      if (!hasConnectedBefore.current) {
        hasConnectedBefore.current = true;
        return;
      }
      syncProfilesOnReconnect(queryClient);
    };

    socket.on("profile:updated", handleProfileUpdated);
    socket.on("connect", handleConnect);

    // If already connected on mount, mark as first connection
    if (socket.connected) {
      hasConnectedBefore.current = true;
    }

    return () => {
      socket.off("profile:updated", handleProfileUpdated);
      socket.off("connect", handleConnect);
    };
  }, [socket, queryClient]);
}
