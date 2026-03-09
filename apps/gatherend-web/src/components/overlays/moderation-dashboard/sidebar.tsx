"use client";

import { cn } from "@/lib/utils";
import {
  Flag,
  AlertTriangle,
  Users,
  BarChart3,
  Shield,
  Search,
} from "lucide-react";

export type ModerationTab =
  | "reports"
  | "strikes"
  | "banned-users"
  | "user-lookup"
  | "stats";

interface ModerationSidebarProps {
  tab: ModerationTab;
  setTab: (tab: ModerationTab) => void;
}

export const ModerationSidebar = ({ tab, setTab }: ModerationSidebarProps) => {
  const items: { id: ModerationTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "reports",
      label: "Reports",
      icon: <Flag className="w-4 h-4" />,
    },
    {
      id: "strikes",
      label: "Strikes",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      id: "banned-users",
      label: "Banned Users",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "user-lookup",
      label: "User Lookup",
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: "stats",
      label: "Statistics",
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-52 border-r border-theme-border-secondary p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 mb-4">
        <Shield className="w-5 h-5 text-red-400" />
        <h2 className="text-sm font-semibold text-theme-text-primary">
          Moderation
        </h2>
      </div>

      {/* Navigation */}
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "w-full cursor-pointer text-left px-3 py-2 rounded-md text-sm font-medium transition",
              "flex items-center gap-2",
              tab === item.id
                ? "bg-red-500/20 text-red-400"
                : "text-theme-text-subtle hover:bg-theme-bg-tab-hover"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
};
