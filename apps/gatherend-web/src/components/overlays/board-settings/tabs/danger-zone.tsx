"use client";

import { Board } from "@prisma/client";
import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useOverlayStore } from "@/hooks/use-overlay-store";
import { useTranslation } from "@/i18n";

interface DangerZoneProps {
  board: Board;
}

export const DangerZoneTab = ({ board }: DangerZoneProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { onClose } = useOverlayStore();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const onDeleteBoard = async () => {
    try {
      setIsLoading(true);

      await axios.delete(`/api/boards/${board.id}`);

      // SPA: Invalidar cache de boards para que la lista se actualice
      queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      // Remover el board del cache específico
      queryClient.removeQueries({ queryKey: ["board", board.id] });

      toast.success(t.overlays.boardSettings.dangerZone.deleteSuccess);
      setShowConfirmDialog(false);
      onClose(); // Close the settings overlay
      router.push("/boards");
    } catch (error) {
      console.error(error);
      toast.error(t.overlays.boardSettings.dangerZone.deleteError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-red-500">
            {t.overlays.boardSettings.dangerZone.title}
          </h2>
          <p className="text-sm text-theme-text-tertiary mt-1">
            {t.overlays.boardSettings.dangerZone.subtitle}
          </p>
        </div>

        <div className="p-6 border-2 border-red-400/50 bg-red-950/20 rounded-lg">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-red-400 mb-1">
                {t.overlays.boardSettings.dangerZone.deleteSectionTitle}
              </h3>
              <p className="text-sm text-red-300">
                {t.overlays.boardSettings.dangerZone.deleteSectionDescription}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowConfirmDialog(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {t.overlays.boardSettings.dangerZone.deleteBoardButton}
          </Button>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-theme-bg-overlay-primary text-theme-text-light">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {t.overlays.boardSettings.dangerZone.confirmTitle}
            </DialogTitle>
            <DialogDescription className="text-theme-text-muted">
              {t.overlays.boardSettings.dangerZone.confirmQuestion} <br />
              <span className="font-semibold text-red-500">
                {board?.name}
              </span>{" "}
              {t.overlays.boardSettings.dangerZone.confirmWillBeDeleted}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              disabled={isLoading}
              onClick={() => setShowConfirmDialog(false)}
              variant="ghost"
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={isLoading}
              variant="destructive"
              onClick={onDeleteBoard}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading
                ? t.overlays.boardSettings.dangerZone.deleting
                : t.overlays.boardSettings.dangerZone.deleteBoardButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
