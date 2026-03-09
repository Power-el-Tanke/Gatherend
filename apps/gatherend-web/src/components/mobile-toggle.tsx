import { NavigationSidebar } from "@/components/navigation/navigation-sidebar";
import { currentProfile } from "@/lib/current-profile";
import { getBoardWithData } from "@/lib/get-board-with-data";
import { redirect } from "next/navigation";
import { MobileToggleClient } from "./mobile-toggle-client";
import type { BoardWithData } from "@/components/providers/board-provider";

export const MobileToggle = async ({ boardId }: { boardId: string }) => {
  const profile = await currentProfile();

  if (!profile) {
    return redirect("/");
  }

  const board = await getBoardWithData(boardId, profile.id);

  if (!board) {
    return redirect("/");
  }

  const currentMember = board.members.find(
    (member: any) => member.profileId === profile.id
  );

  if (!currentMember) {
    return redirect("/");
  }

  return (
    <MobileToggleClient
      board={board as unknown as BoardWithData}
      role={currentMember.role}
      navigationSidebar={<NavigationSidebar />}
      currentProfileId={profile.id}
    />
  );
};
