"use client";

import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOverlayStore } from "@/hooks/use-overlay-store";

export function AppSettings() {
  const { onOpen: onOpenOverlay } = useOverlayStore();

  return (
    <button
      onClick={() => onOpenOverlay("userSettings")}
      className={cn(
        "p-2 rounded-md transition",
        "text-theme-text-secondary",
        "hover:bg-theme-app-settings-hover cursor-pointer"
      )}
      aria-label="Open settings"
    >
      <Settings className="w-5 h-5" />
    </button>
  );
}
