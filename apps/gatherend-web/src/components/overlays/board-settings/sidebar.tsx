"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

type BoardSettingsTabId = "general" | "members" | "bans" | "danger";

interface SidebarProps {
  tab: BoardSettingsTabId;
  setTab: (tab: BoardSettingsTabId) => void;
  onClose: () => void;
}

export const SettingsSidebar = ({
  tab,
  setTab,
  onClose: _onClose,
}: SidebarProps) => {
  const { t } = useTranslation();

  const items: Array<{ id: BoardSettingsTabId; label: string }> = [
    { id: "general", label: t.overlays.boardSettings.tabs.general },
    { id: "members", label: t.overlays.boardSettings.tabs.members },
    { id: "bans", label: t.overlays.boardSettings.tabs.bans },
    { id: "danger", label: t.overlays.boardSettings.tabs.dangerZone },
  ];

  return (
    <aside className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-theme-border-secondary p-3 sm:p-4">
      <h2 className="text-xs font-semibold uppercase text-theme-text-tertiary mb-2 sm:mb-3 px-2">
        {t.overlays.boardSettings.title}
      </h2>

      <div className="flex sm:block gap-2 sm:space-y-2 overflow-x-auto sm:overflow-x-visible pr-2 sm:pr-0">
        {items.map((i) => (
          <button
            key={i.id}
            onClick={() => setTab(i.id)}
            className={cn(
              "shrink-0 sm:w-full cursor-pointer text-left whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition",
              tab === i.id
                ? "bg-theme-tab-active-bg text-white"
                : "text-theme-text-subtle hover:bg-theme-bg-tab-hover"
            )}
          >
            {i.label}
          </button>
        ))}
      </div>
    </aside>
  );
};
