"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { useSession } from "@/lib/better-auth-client";
import { GatherendOutlineSVG } from "@/lib/gatherend-outline";

interface SessionGuardProps {
  children: React.ReactNode;
}

export function SessionGuard({ children: _children }: SessionGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const hasAttemptedRefresh = useRef(false);

  useEffect(() => {
    if (isPending) return;

    if (hasAttemptedRefresh.current) {
      logger.warn("[SessionGuard] Refresh already attempted, redirecting to sign-in");
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/sign-in?redirect_url=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (!session?.user?.id) {
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/sign-in?redirect_url=${encodeURIComponent(currentPath)}`);
      return;
    }

    hasAttemptedRefresh.current = true;
    router.refresh();
  }, [isPending, router, session?.user?.id]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-theme-bg-tertiary">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-theme-border-primary" />
        <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-2 text-theme-accent-light animate-pulse" />
      </div>
      <p className="text-[18px] text-theme-text-accent">
        {!isPending && !session?.user?.id ? "Redirecting..." : "Loading..."}
      </p>
    </div>
  );
}
