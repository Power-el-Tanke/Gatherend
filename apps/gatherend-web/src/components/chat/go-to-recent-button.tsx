"use client";

import { memo } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoToRecentButtonProps {
  visible: boolean;
  pendingMessages: number;
  onClick: () => void;
}

function GoToRecentButtonComponent({
  visible,
  pendingMessages,
  onClick,
}: GoToRecentButtonProps) {
  if (!visible) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <Button
        onClick={onClick}
        variant="secondary"
        size="sm"
        className="shadow-lg flex items-center gap-2 bg-theme-bg-primary border border-theme-border hover:bg-theme-bg-secondary"
      >
        <ArrowDown className="h-4 w-4" />
        <span>Ir a lo más reciente</span>
        {pendingMessages > 0 && (
          <span className="bg-theme-accent text-white text-xs px-1.5 py-0.5 rounded-full min-w-5 text-center">
            {pendingMessages > 99 ? "99+" : pendingMessages}
          </span>
        )}
      </Button>
    </div>
  );
}

export const GoToRecentButton = memo(GoToRecentButtonComponent);
