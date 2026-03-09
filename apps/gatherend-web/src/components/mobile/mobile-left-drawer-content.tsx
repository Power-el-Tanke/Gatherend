"use client";

import { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

interface MobileLeftDrawerContentProps {
  navigationSidebar: ReactNode;
  leftbar: ReactNode;
}

export function MobileLeftDrawerContent({
  navigationSidebar,
  leftbar,
}: MobileLeftDrawerContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Navigation Sidebar - Boards grid (altura fija, similar al desktop) */}
      <div className="h-[35%] min-h-[150px] max-h-[350px] overflow-y-auto bg-theme-bg-primary">
        {navigationSidebar}
      </div>

      <Separator className="bg-theme-border-secondary flex-shrink-0" />

      {/* Board Leftbar - Channels (ocupa el resto del espacio) */}
      <div className="flex-1 overflow-y-auto bg-theme-bg-secondary">
        {leftbar}
      </div>
    </div>
  );
}
