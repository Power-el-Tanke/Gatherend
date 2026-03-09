"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";
import { useDeleteChannel, useBoardData } from "@/hooks/use-board-data";
import { ChannelType } from "@prisma/client";
import { logger } from "@/lib/logger";
import { useTranslation } from "@/i18n";

export const DeleteChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "deleteChannel";
  const { board, boardId: dataBoardId, channel } = data;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;

  // Obtener datos del board desde React Query cache
  const { data: boardData } = useBoardData(boardId || "");

  // Usar useMutation con optimistic update
  const { mutate: deleteChannel, isPending } = useDeleteChannel();

  // Detectar si el usuario está actualmente en el canal que se va a borrar
  const currentChannelId = params?.roomId as string | undefined;
  const isInDeletedChannel = currentChannelId === channel?.id;

  const onClick = () => {
    if (!channel?.id || !boardId) return;

    // Calcular el primer canal DENTRO del onClick para tener los datos más frescos
    // y antes de que el optimistic update los modifique
    const targetChannel = findFirstTextChannel(boardData, channel.id);

    deleteChannel(
      { channelId: channel.id, boardId },
      {
        onSuccess: () => {
          onClose();

          // Solo navegar si el usuario está en el canal que se borró
          if (isInDeletedChannel) {
            if (targetChannel) {
              router.push(`/boards/${boardId}/rooms/${targetChannel.id}`);
            } else {
              router.push(`/boards/${boardId}`);
            }
          }
        },
        onError: (error) => {
          logger.error("Failed to delete channel:", error);
        },
      },
    );
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-theme-bg-modal !max-w-[400px] text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.deleteChannel.title}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] text-theme-text-tertiary">
            {t.modals.deleteChannel.description} <br />
            <span className="font-semibold text-red-400">
              /{channel?.name}
            </span>{" "}
            {t.modals.deleteChannel.willBeDeleted}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-theme-bg-modal px-6 py-4">
          <div className="flex items-center justify-center gap-20 w-full">
            <Button
              disabled={isPending}
              onClick={onClose}
              className="bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={isPending}
              className="bg-red-500 cursor-pointer hover:bg-red-600 text-theme-text-light hover:text-theme-text-light"
              onClick={onClick}
            >
              {t.common.confirm}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Encuentra el primer canal de texto disponible en el board
 * Busca el canal TEXT con la posición más baja (excluyendo el que se borra)
 */
function findFirstTextChannel(
  boardData: ReturnType<typeof useBoardData>["data"],
  excludeChannelId: string,
): { id: string; name: string } | null {
  if (!boardData) return null;

  // Buscar el canal TEXT con la posición más baja
  const firstTextChannel = boardData.channels
    .filter((ch) => ch.type === ChannelType.TEXT && ch.id !== excludeChannelId)
    .sort((a, b) => a.position - b.position)[0];

  if (firstTextChannel) {
    return { id: firstTextChannel.id, name: firstTextChannel.name };
  }

  return null;
}
