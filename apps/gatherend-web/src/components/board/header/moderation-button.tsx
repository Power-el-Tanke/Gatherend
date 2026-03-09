"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ModerationDashboardOverlay } from "@/components/overlays/moderation-dashboard/moderation-dashboard-overlay";
import { ActionTooltip } from "@/components/action-tooltip";

export const ModerationButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ActionTooltip label="Moderation" side="bottom">
        <button
          onClick={() => setIsOpen(true)}
          className="relative p-2 rounded-md hover:bg-red-500/10 transition group"
        >
          <ShieldAlert className="w-5 h-5 text-red-400 group-hover:text-red-300 transition" />

          {/* Notification dot - TODO: show when pending reports > 0 */}
          {/* <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" /> */}
        </button>
      </ActionTooltip>

      {isOpen && (
        <ModerationDashboardOverlay onClose={() => setIsOpen(false)} />
      )}
    </>
  );
};
