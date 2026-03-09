"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useSocketClient } from "@/components/providers/socket-provider";

const MAX_PROFILE_IDS_PER_HOOK = 100;

function normalizeProfileIds(profileIds: string[]): string[] {
  const unique = new Set<string>();
  for (const id of profileIds) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
    if (unique.size >= MAX_PROFILE_IDS_PER_HOOK) break;
  }
  return [...unique];
}

type SubscriptionSnapshot = {
  ids: string[];
  set: Set<string>;
};

type SocketBinding = {
  socket: Socket;
  onConnect: () => void;
};

const refCounts = new Map<string, number>();
let socketBinding: SocketBinding | null = null;

function ensureSocketBound(socket: Socket) {
  if (socketBinding?.socket === socket) return;

  // Detach previous binding
  if (socketBinding) {
    socketBinding.socket.off("connect", socketBinding.onConnect);
    socketBinding = null;
  }

  const onConnect = () => {
    const ids = [...refCounts.keys()];
    if (ids.length === 0) return;
    socket.emit("profile:subscribe", { profileIds: ids });
  };

  socket.on("connect", onConnect);
  socketBinding = { socket, onConnect };

  // If we're already connected, make sure the server has the rooms.
  if (socket.connected) {
    onConnect();
  }
}

function subscribe(socket: Socket, profileIds: string[]) {
  const added: string[] = [];
  for (const id of profileIds) {
    const prev = refCounts.get(id) ?? 0;
    const next = prev + 1;
    refCounts.set(id, next);
    if (prev === 0) added.push(id);
  }

  if (added.length > 0 && socket.connected) {
    socket.emit("profile:subscribe", { profileIds: added });
  }
}

function unsubscribe(socket: Socket, profileIds: string[]) {
  const removed: string[] = [];
  for (const id of profileIds) {
    const prev = refCounts.get(id) ?? 0;
    if (prev <= 1) {
      refCounts.delete(id);
      removed.push(id);
      continue;
    }
    refCounts.set(id, prev - 1);
  }

  if (removed.length > 0 && socket.connected) {
    socket.emit("profile:unsubscribe", { profileIds: removed });
  }
}

/**
 * Subscribe this client to profile watch rooms (deduped + ref-counted globally).
 *
 * Server-side rooms are `profile-watch:${profileId}` (not `profile:${profileId}`).
 */
export function useProfileRoomSubscriptions(profileIds: string[]) {
  const { socket } = useSocketClient();

  const snapshot: SubscriptionSnapshot = useMemo(() => {
    const ids = normalizeProfileIds(profileIds);
    return { ids, set: new Set(ids) };
  }, [profileIds]);

  const prevRef = useRef<SubscriptionSnapshot>({ ids: [], set: new Set() });

  useEffect(() => {
    if (!socket) return;

    ensureSocketBound(socket);

    const prev = prevRef.current;
    const next = snapshot;

    const toAdd: string[] = [];
    for (const id of next.ids) {
      if (!prev.set.has(id)) toAdd.push(id);
    }

    const toRemove: string[] = [];
    for (const id of prev.ids) {
      if (!next.set.has(id)) toRemove.push(id);
    }

    if (toAdd.length > 0) subscribe(socket, toAdd);
    if (toRemove.length > 0) unsubscribe(socket, toRemove);

    prevRef.current = next;
    // Intentionally exclude `snapshot` object identity from deps (derived from `profileIds`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, snapshot.ids.join("|")]);

  useEffect(() => {
    if (!socket) return;

    return () => {
      const prev = prevRef.current;
      if (prev.ids.length > 0) {
        unsubscribe(socket, prev.ids);
      }
      prevRef.current = { ids: [], set: new Set() };
    };
  }, [socket]);
}
