"use client";

import { BoardDiscovery } from "./board-discovery";
import { AppSettings } from "./app-settings";
import { CustomUserButton } from "./custom-user-button";
import { ModerationButton } from "./moderation-button";
import { useState, useEffect } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";

export function BoardHeader() {
  const [mounted, setMounted] = useState(false);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative flex items-center h-full w-full px-4">
      {/* CENTER - Posicionado en el centro del espacio entre leftbar y rightbar */}
      {/* El header va de left:312px a right:0, pero el rightbar ocupa 256px (w-64) */}
      {/* Usamos left: calc(50% - 128px) para compensar la mitad del rightbar */}
      <div className="absolute left-[calc(50%-128px)] -translate-x-1/2 w-[calc(100%-400px)]">
        <BoardDiscovery />
      </div>

      {/* RIGHT SIDE */}
      <div className="ml-auto flex items-center gap-3">
        {mounted && isAdmin && <ModerationButton />}
        {mounted && <CustomUserButton />}
        <AppSettings />
      </div>
    </div>
  );
}
