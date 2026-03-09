"use client";

import { useEffect, useState } from "react";
import type { ClientProfile } from "@/hooks/use-current-profile";
import axios from "axios";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSocketClient } from "@/components/providers/socket-provider";
import { signOut } from "@/lib/better-auth-client";
import { useTranslation } from "@/i18n";

interface UserDangerZoneTabProps {
  user: ClientProfile;
  onClose: () => void;
  setOverlayBlocking: (value: boolean) => void;
}

export const UserDangerZoneTab = ({
  user,
  onClose,
  setOverlayBlocking,
}: UserDangerZoneTabProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { goOffline } = useSocketClient();
  const { t } = useTranslation();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [closeOnRouteChange, setCloseOnRouteChange] = useState(false);

  useEffect(() => {
    if (!closeOnRouteChange) return;
    if (pathname === "/") {
      onClose();
    }
  }, [closeOnRouteChange, onClose, pathname]);

  const onDeleteAccount = async () => {
    try {
      if (isDeletingAccount) return;
      setIsDeletingAccount(true);
      setOverlayBlocking(true);
      setShowConfirmDialog(false);

      await axios.delete("/api/profile");
      goOffline();

      try {
        await signOut();
      } catch (signOutError) {
        console.warn("[ACCOUNT_DELETE_SIGNOUT]", signOutError);
      }

      toast.success(t.overlays.userSettings.dangerZone.deleteSuccess);
      setCloseOnRouteChange(true);
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(t.overlays.userSettings.dangerZone.deleteError);
      setOverlayBlocking(false);
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-red-500">
            {t.overlays.userSettings.dangerZone.title}
          </h2>
          <p className="text-sm text-theme-text-tertiary mt-1">
            {t.overlays.userSettings.dangerZone.subtitle}
          </p>
        </div>

        <div className="p-6 border-1 border-red-400/50 bg-red-950/20 rounded-lg">
          <div className="flex items-start gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-red-400 mb-1">
                {t.overlays.userSettings.dangerZone.deleteSectionTitle}
              </h3>
              <p className="text-sm text-red-300">
                {t.overlays.userSettings.dangerZone.deleteSectionDescription}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowConfirmDialog(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={isDeletingAccount}
          >
            {isDeletingAccount ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isDeletingAccount
              ? t.overlays.userSettings.dangerZone.deletingAccount
              : t.overlays.userSettings.dangerZone.deleteAccount}
          </Button>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-theme-bg-overlay-primary text-theme-text-light">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {t.overlays.userSettings.dangerZone.confirmTitle}
            </DialogTitle>
            <DialogDescription className="text-theme-text-muted">
              {t.overlays.userSettings.dangerZone.confirmQuestion} <br />
              <span className="font-semibold text-red-500">
                {user.username}#{user.discriminator}
              </span>{" "}
              {t.overlays.userSettings.dangerZone.confirmWillBeDeleted}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              disabled={isDeletingAccount}
              onClick={() => setShowConfirmDialog(false)}
              variant="ghost"
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={isDeletingAccount}
              variant="destructive"
              onClick={onDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingAccount ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {isDeletingAccount
                ? t.overlays.userSettings.dangerZone.deletingAccount
                : t.overlays.userSettings.dangerZone.deleteAccount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
