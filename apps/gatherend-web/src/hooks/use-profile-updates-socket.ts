"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketClient } from "@/components/providers/socket-provider";
import { conversationsQueryKey, type FormattedConversation } from "./use-conversations";
import { chatMessageWindowStore } from "@/hooks/chat/chat-message-window-store";

type ProfilePatch = Record<string, unknown>;

function applyPatch<T extends Record<string, any>>(obj: T, patch: ProfilePatch): T {
  const next: Record<string, any> = { ...obj };
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (Object.is(next[key], value)) continue;
    next[key] = value;
    changed = true;
  }

  return changed ? (next as T) : obj;
}

function patchConversationProfiles(
  conversation: FormattedConversation,
  profileId: string,
  patch: ProfilePatch,
): FormattedConversation {
  const shouldPatchOther = conversation.otherProfile?.id === profileId;
  const shouldPatchOne = conversation.profileOne?.id === profileId;
  const shouldPatchTwo = conversation.profileTwo?.id === profileId;

  if (!shouldPatchOther && !shouldPatchOne && !shouldPatchTwo) return conversation;

  return {
    ...conversation,
    otherProfile: shouldPatchOther
      ? applyPatch(conversation.otherProfile as any, patch)
      : conversation.otherProfile,
    profileOne: shouldPatchOne
      ? applyPatch(conversation.profileOne as any, patch)
      : conversation.profileOne,
    profileTwo: shouldPatchTwo
      ? applyPatch(conversation.profileTwo as any, patch)
      : conversation.profileTwo,
  };
}

function patchBoardProfiles(board: any, profileId: string, patch: ProfilePatch): any {
  let changed = false;

  const nextMembers = Array.isArray(board?.members)
    ? board.members.map((m: any) => {
        const pid = m?.profile?.id ?? m?.profileId;
        if (pid !== profileId || !m?.profile) return m;
        const nextProfile = applyPatch(m.profile, patch);
        if (nextProfile === m.profile) return m;
        changed = true;
        return { ...m, profile: nextProfile };
      })
    : board?.members;

  const nextSlots = Array.isArray(board?.slots)
    ? board.slots.map((s: any) => {
        const pid = s?.member?.profile?.id;
        if (pid !== profileId || !s?.member?.profile) return s;
        const nextProfile = applyPatch(s.member.profile, patch);
        if (nextProfile === s.member.profile) return s;
        changed = true;
        return {
          ...s,
          member: {
            ...s.member,
            profile: nextProfile,
          },
        };
      })
    : board?.slots;

  if (!changed) return board;

  return {
    ...board,
    members: nextMembers,
    slots: nextSlots,
  };
}

export function useProfileUpdatesSocket() {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleProfileUpdated = (payload: any) => {
      const profileId = payload?.profileId;
      const patch = payload?.patch as ProfilePatch | undefined;
      if (typeof profileId !== "string" || !profileId) return;
      if (!patch || typeof patch !== "object") return;


      // Conversations list
      queryClient.setQueryData<FormattedConversation[]>(
        conversationsQueryKey,
        (old) => {
          if (!old) return old;
          let changed = false;
          const next = old.map((c) => {
            const patched = patchConversationProfiles(c, profileId, patch);
            if (patched !== c) changed = true;
            return patched;
          });
          return changed ? next : old;
        },
      );

      // Individual conversation caches (deep links)
      const conversationQueries = queryClient
        .getQueryCache()
        .findAll({ queryKey: ["conversation"] });
      for (const q of conversationQueries) {
        const key = q.queryKey as any;
        queryClient.setQueryData(key, (old: any) => {
          if (!old) return old;
          const oneId = old?.profileOne?.id;
          const twoId = old?.profileTwo?.id;
          if (oneId !== profileId && twoId !== profileId) return old;
          return {
            ...old,
            profileOne:
              oneId === profileId ? applyPatch(old.profileOne, patch) : old.profileOne,
            profileTwo:
              twoId === profileId ? applyPatch(old.profileTwo, patch) : old.profileTwo,
          };
        });
      }

      // Boards (multiple cached boards)
      const boardQueries = queryClient.getQueryCache().findAll({ queryKey: ["board"] });
      for (const q of boardQueries) {
        const key = q.queryKey as any;
        queryClient.setQueryData(key, (old: any) => {
          if (!old) return old;
          return patchBoardProfiles(old, profileId, patch);
        });
      }

      // Profile card (user menu)
      queryClient.setQueryData(["profile-card", profileId], (old: any) => {
        if (!old) return old;
        return applyPatch(old, patch);
      });

      // Chat windows (messages + replies + reactions)
      chatMessageWindowStore.patchProfile(profileId, patch);
    };

    socket.on("profile:updated", handleProfileUpdated);

    return () => {
      socket.off("profile:updated", handleProfileUpdated);
    };
  }, [socket, queryClient]);
}

