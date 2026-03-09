// Profile watch room socket handlers
import { Server, Socket } from "socket.io";
import { logger } from "../lib/logger.js";

type SocketPayload = Record<string, unknown>;

function isSocketPayload(value: unknown): value is SocketPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseProfileIds(payload?: unknown): string[] {
  if (!isSocketPayload(payload)) return [];
  const raw = payload.profileIds;
  if (!Array.isArray(raw)) return [];

  const unique = new Set<string>();
  for (const item of raw) {
    const id = toNonEmptyString(item);
    if (!id) continue;
    unique.add(id);
    if (unique.size >= 100) break;
  }

  return [...unique];
}

function toProfileWatchRoom(profileId: string): string {
  // IMPORTANT: Do not use `profile:${id}` (reserved for user-specific notifications).
  return `profile-watch:${profileId}`;
}

/**
 * Register profile watch socket event handlers
 *
 * Client events:
 * - profile:subscribe   { profileIds: string[] }
 * - profile:unsubscribe { profileIds: string[] }
 *
 * Server rooms:
 * - profile-watch:${profileId}
 */
export function registerProfileHandlers(_io: Server, socket: Socket) {
  socket.on("profile:subscribe", (payload?: unknown) => {
    try {
      const profileIds = parseProfileIds(payload);
      if (profileIds.length === 0) return;
      const rooms = profileIds.map(toProfileWatchRoom);
      for (const room of rooms) socket.join(room);
    } catch (error) {
      logger.error(`Error in profile:subscribe for ${socket.id}:`, error);
    }
  });

  socket.on("profile:unsubscribe", (payload?: unknown) => {
    try {
      const profileIds = parseProfileIds(payload);
      if (profileIds.length === 0) return;
      const rooms = profileIds.map(toProfileWatchRoom);
      for (const room of rooms) socket.leave(room);
    } catch (error) {
      logger.error(`Error in profile:unsubscribe for ${socket.id}:`, error);
    }
  });
}
