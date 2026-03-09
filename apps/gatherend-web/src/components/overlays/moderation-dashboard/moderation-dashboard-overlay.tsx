"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { ModerationSidebar, ModerationTab } from "./sidebar";
import { ReportsTab } from "./tabs/reports";
import { StrikesTab } from "./tabs/strikes";
import { BannedUsersTab } from "./tabs/banned-users";
import { UserLookupTab } from "./tabs/user-lookup";
import { StatsTab } from "./tabs/stats";

interface ModerationDashboardOverlayProps {
  onClose: () => void;
}

export const ModerationDashboardOverlay = ({
  onClose,
}: ModerationDashboardOverlayProps) => {
  const [tab, setTab] = useState<ModerationTab>("reports");

  return (
    <div className="fixed inset-0 z-[9999] backdrop-blur-sm flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className={cn(
          "relative bg-theme-bg-overlay-primary h-[85vh] w-full max-w-5xl mx-4",
          "rounded-lg shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        )}
      >
        {/* SIDEBAR */}
        <ModerationSidebar tab={tab} setTab={setTab} />

        {/* MAIN PANEL */}
        <div className="flex-1 p-6 overflow-y-auto">
          {tab === "reports" && <ReportsTab />}
          {tab === "strikes" && <StrikesTab />}
          {tab === "banned-users" && <BannedUsersTab />}
          {tab === "user-lookup" && <UserLookupTab />}
          {tab === "stats" && <StatsTab />}
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-white/10 transition"
        >
          <X className="w-5 h-5 text-theme-text-subtle" />
        </button>
      </div>
    </div>
  );
};
