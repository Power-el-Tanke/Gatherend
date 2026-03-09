"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BoardLeftbar } from "@/components/board/leftbar/board-leftbar";
import { MemberRole } from "@prisma/client";
import type { BoardWithData } from "@/components/providers/board-provider";

interface MobileToggleClientProps {
  board: BoardWithData;
  role: MemberRole;
  navigationSidebar: React.ReactNode;
  currentProfileId: string;
}

export const MobileToggleClient = ({
  board,
  role,
  navigationSidebar,
  currentProfileId,
}: MobileToggleClientProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild suppressHydrationWarning>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 flex gap-0">
        <div className="w-[72px]">{navigationSidebar}</div>
        <BoardLeftbar
          board={board}
          role={role}
          currentProfileId={currentProfileId}
        />
      </SheetContent>
    </Sheet>
  );
};
