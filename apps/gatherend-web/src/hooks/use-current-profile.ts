"use client";

import { useQuery } from "@tanstack/react-query";
import { Languages } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import { useEffect, useRef } from "react";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { useTokenReady } from "@/components/providers/token-manager-provider";
import { useSession } from "@/lib/better-auth-client";

export interface ClientProfile {
  id: string;
  username: string;
  discriminator: string;
  imageUrl: string | null;
  email: string;
  languages: Languages[];
  usernameColor: JsonValue;
  profileTags: string[];
  badge: string | null;
  badgeStickerUrl: string | null;
  usernameFormat: JsonValue;
  longDescription: string | null;
  themeConfig: JsonValue;
}

export function useCurrentProfile() {
  const { data: session, isPending } = useSession();
  const tokenReady = useTokenReady();
  const isSignedIn = Boolean(session?.user?.id);
  const isLoaded = !isPending;

  const query = useQuery<ClientProfile>({
    queryKey: ["current-profile"],
    queryFn: async () => {
      if (!isLoaded || !tokenReady) {
        throw new Error("Auth not loaded");
      }

      if (!isSignedIn) {
        throw new Error("Not signed in");
      }

      const response = await fetchWithRetry("/api/profile/me");

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch profile");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: isLoaded && isSignedIn && tokenReady,
  });

  const prevCauseRef = useRef<{
    isLoaded: boolean;
    isSignedIn: boolean;
    tokenReady: boolean;
    status: string;
    fetchStatus: string;
    profileId: string | null;
    dataUpdatedAt: number;
  } | null>(null);

  useEffect(() => {
    const current = {
      isLoaded,
      isSignedIn,
      tokenReady,
      status: String(query.status),
      fetchStatus: String(query.fetchStatus),
      profileId: query.data?.id ?? null,
      dataUpdatedAt: query.dataUpdatedAt,
    };

    const prev = prevCauseRef.current;
    const changed: string[] = [];

    if (!prev || prev.isLoaded !== current.isLoaded) changed.push("isLoaded");
    if (!prev || prev.isSignedIn !== current.isSignedIn)
      changed.push("isSignedIn");
    if (!prev || prev.tokenReady !== current.tokenReady)
      changed.push("tokenReady");
    if (!prev || prev.status !== current.status) changed.push("status");
    if (!prev || prev.fetchStatus !== current.fetchStatus)
      changed.push("fetchStatus");
    if (!prev || prev.profileId !== current.profileId)
      changed.push("profileId");
    if (!prev || prev.dataUpdatedAt !== current.dataUpdatedAt)
      changed.push("dataUpdatedAt");

    if (changed.length > 0) {
    }

    prevCauseRef.current = current;
  }, [
    isLoaded,
    isSignedIn,
    query.data?.id,
    query.dataUpdatedAt,
    query.fetchStatus,
    query.status,
    tokenReady,
  ]);

  return query;
}
