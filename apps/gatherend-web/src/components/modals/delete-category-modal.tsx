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
import { useRouter } from "next/navigation";
import { useDeleteCategory } from "@/hooks/use-board-data";
import { useTranslation } from "@/i18n";

export const DeleteCategoryModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const router = useRouter();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "deleteCategory";
  const { board, boardId: dataBoardId, categoryId, categoryName } = data;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;

  // Usar useMutation con optimistic update
  const { mutate: deleteCategory, isPending } = useDeleteCategory();

  if (!boardId || !categoryId) return null;

  const onClick = () => {
    deleteCategory(
      { categoryId, boardId },
      {
        onSuccess: () => {
          onClose();
          router.push(`/boards/${boardId}`);
        },
        onError: (error) => {
          console.error("Failed to delete category:", error);
          // El rollback ya se hace automáticamente en onError del mutation
        },
      },
    );
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-theme-bg-modal text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.deleteCategory.title}
          </DialogTitle>
          <DialogDescription className="text-center text-theme-text-tertiary">
            {t.modals.deleteCategory.description} <br />
            <span className="font-semibold text-theme-accent-primary">
              #{categoryName}
            </span>{" "}
            {t.modals.deleteCategory.willBeDeleted}
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
