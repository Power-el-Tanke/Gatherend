"use client";

import { useEffect } from "react";
import { GatherendOutlineSVG } from "@/lib/gatherend-outline";

interface BoardRedirectProps {
  boardId: string;
}

export function BoardRedirect({ boardId }: BoardRedirectProps) {
  useEffect(() => {
    // Usar window.location para forzar navegación completa
    window.location.href = `/boards/${boardId}/discovery`;
  }, [boardId]);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-theme-bg-tertiary">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-theme-border-primary" />
        <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-2 text-theme-accent-light animate-pulse" />
      </div>
      <p className="text-[18px] text-theme-text-accent">
        Loading your board...
      </p>
    </div>
  );
}
