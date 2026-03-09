"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { memo, useTransition } from "react";
import { useBoardSwitchNavigation } from "@/contexts/board-switch-context";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import { useTranslation } from "@/i18n";

/**
 * BoardDiscovery es el botón para navegar al discovery del board.
 */
export const BoardDiscovery = memo(function BoardDiscovery() {
  const { switchToDiscovery, isClientNavigationEnabled } =
    useBoardSwitchNavigation();
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslation();

  const handleClick = () => {
    startTransition(() => {
      if (isClientNavigationEnabled) {
        switchToDiscovery();
      } else {
        const boardId = useBoardNavigationStore.getState().currentBoardId;
        window.location.href = `/boards/${boardId}/discovery`;
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "h-8 px-3 w-full",
        "flex items-center justify-center gap-2",
        "text-base font-semibold tracking-wide",
        "bg-theme-button-primary text-white",
        "border border-white/10",
        "shadow-sm transition-all duration-150",
        "hover:bg-theme-button-hover hover:text-white hover:border-white/20 hover:shadow-md",
        "active:scale-[0.98] cursor-pointer",
        "[clip-path:polygon(0_0,100%_0,97%_50%,100%_100%,0_100%,3%_50%)]",
        isPending && "opacity-50 cursor-not-allowed",
      )}
    >
      <Users className="w-5.5 h-5.5" />
      {t.discovery.meetNewFriends}
    </button>
  );
});
