// /components/board/rightbar/board-rightbar.tsx
"use client";

import { DirectMessages } from "./rightbar-direct-messages-list";
import { Separator } from "@/components/ui/separator";
import { SlotGrid } from "./members-section/member-grid";
import { FormattedConversation } from "@/hooks/use-conversations";
import type { BoardWithData } from "@/components/providers/board-provider";
import { useTranslation } from "@/i18n";
import { VoiceControlBar } from "@/components/voice-control-bar";
import type { ClientProfile } from "@/hooks/use-current-profile";

interface BoardRightbarProps {
  board: BoardWithData;
  conversations: FormattedConversation[];
  currentProfileId: string;
  currentProfile?: ClientProfile;
}

export const BoardRightbar = ({
  board,
  conversations,
  currentProfileId,
  currentProfile,
}: BoardRightbarProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full w-full">
      {/* Members */}
      <div className="px-4 pt-3 pb-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary">
          {t.rightbar.members} —{" "}
          {board.slots.filter((s) => s.member !== null).length}/
          {board.slots.length}
        </h2>
      </div>

      <SlotGrid
        slots={board.slots}
        currentProfileId={currentProfileId}
        currentProfile={currentProfile}
      />

      <Separator className="bg-theme-border-primary rounded-md mt-0 mb-2" />

      {/* Direct Messages */}
      <DirectMessages
        conversations={conversations}
        currentProfileId={currentProfileId}
      />

      {/* Voice Control Bar - aparece al final cuando hay llamada activa */}
      <VoiceControlBar position="right" />
    </div>
  );
};
