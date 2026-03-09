"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { ProfileTab } from "@/components/overlays/profile-settings/tabs/profile";
import { ProfileSettingsSidebar } from "./tabs/sidebar";
import { useCurrentProfile } from "@/hooks/use-current-profile";

// Skeleton for settings overlay loading
function SettingsOverlaySkeleton() {
  return (
    <div className="w-48 space-y-3">
      <div className="h-5 bg-white/10 rounded w-3/4 animate-pulse" />
      <div className="h-4 bg-white/5 rounded w-full animate-pulse" />
      <div className="h-4 bg-white/5 rounded w-2/3 animate-pulse" />
    </div>
  );
}

interface ProfileSettingsOverlayProps {
  onClose: () => void;
}

export const ProfileSettingsOverlay = ({
  onClose,
}: ProfileSettingsOverlayProps) => {
  const [tab, setTab] = useState<"profile">("profile");

  // Obtener perfil desde React Query para tener datos siempre actualizados
  const { data: user, isLoading } = useCurrentProfile();

  if (typeof document === "undefined") {
    return null;
  }

  if (isLoading || !user) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
        <div className="bg-theme-bg-overlay-primary p-8 rounded-lg">
          <SettingsOverlaySkeleton />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto overscroll-contain pointer-events-auto">
      <div
        className={cn(
          "relative bg-theme-bg-overlay-primary w-full max-w-3xl h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-3rem)]",
          "rounded-lg shadow-2xl flex flex-col sm:flex-row overflow-hidden animate-in fade-in zoom-in duration-150"
        )}
      >
        {/* SIDEBAR */}
        <ProfileSettingsSidebar tab={tab} setTab={setTab} onClose={onClose} />

        {/* MAIN PANEL */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {tab === "profile" && <ProfileTab user={user} />}
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-white/10 transition"
        >
          <X className="w-5 h-5 text-theme-text-subtle" />
        </button>
      </div>
    </div>,
    document.body
  );
};
