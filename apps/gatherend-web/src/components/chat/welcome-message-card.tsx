"use client";

import { GatherendOutlineSVG } from "@/lib/gatherend-outline";
import { Board } from "@prisma/client";
import { useTranslation } from "@/i18n";

interface WelcomeMessageCardProps {
  board: Board;
}

export function WelcomeMessageCard({ board }: WelcomeMessageCardProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center py-6 opacity-90">
      <div className="relative w-28 h-28 mb-3">
        <div className="absolute inset-0 rounded-full bg-theme-bg-quaternary" />
        <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-4 text-theme-accent-light" />
      </div>

      <p className="text-theme-text-subtle text-sm px-4">
        {t.chat.welcomeTo} <span className="font-semibold">{board.name}</span>!
        <br />
        {t.chat.welcomeHopeGoodTime}
      </p>
    </div>
  );
}
