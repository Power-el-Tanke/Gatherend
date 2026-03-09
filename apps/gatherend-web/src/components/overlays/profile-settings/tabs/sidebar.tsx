"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

interface SidebarProps {
  tab: "profile";
  setTab: (tab: "profile") => void;
  onClose: () => void;
}

export const ProfileSettingsSidebar = ({
  tab,
  setTab,
  onClose,
}: SidebarProps) => {
  const { t } = useTranslation();

  return (
    <div className="w-full sm:w-32 md:w-56 bg-theme-bg-overlay-primary border-b sm:border-b-0 sm:border-r border-theme-border-secondary p-3 sm:p-2 md:p-4 flex flex-col">
      <h2 className="text-xs uppercase font-bold text-theme-text-muted mb-2 sm:mb-4">
        {t.overlays.profileSettings.title}
      </h2>

      <button
        onClick={() => setTab("profile")}
        className={cn(
          "text-left px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap",
          tab === "profile"
            ? "bg-theme-tab-active-bg text-white"
            : "hover:bg-theme-channel-hover text-theme-text-subtle"
        )}
      >
        {t.overlays.profileSettings.tabs.profile}
      </button>
    </div>
  );
};
