"use client";

import type { ClientProfile } from "@/hooks/use-current-profile";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { useSocketClient } from "@/components/providers/socket-provider";
import { signOut } from "@/lib/better-auth-client";
import { useEffect, useState } from "react";

interface LogoutTabProps {
  user: ClientProfile;
  onClose: () => void;
  setOverlayBlocking: (value: boolean) => void;
}

export const LogoutTab = ({
  user: _user,
  onClose,
  setOverlayBlocking,
}: LogoutTabProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { goOffline } = useSocketClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [closeOnRouteChange, setCloseOnRouteChange] = useState(false);

  useEffect(() => {
    if (!closeOnRouteChange) return;
    if (pathname === "/") {
      onClose();
    }
  }, [closeOnRouteChange, onClose, pathname]);

  const handleLogout = async () => {
    try {
      if (isSigningOut) return;
      setIsSigningOut(true);
      setOverlayBlocking(true);
      goOffline();
      await signOut();
      toast.success(t.overlays.userSettings.logout.logoutSuccess);
      setCloseOnRouteChange(true);
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(t.overlays.userSettings.logout.logoutError);
      setOverlayBlocking(false);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-theme-text-light">
          {t.overlays.userSettings.logout.title}
        </h2>
        <p className="text-sm text-theme-text-muted">
          {t.overlays.userSettings.logout.subtitle}
        </p>
      </div>

      <div className="p-6 bg-theme-bg-secondary rounded-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="py-3 pl-3 pr-2 bg-red-900/30 rounded-full">
            <LogOut className="h-6 w-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-theme-text-subtle">
              {t.overlays.userSettings.logout.signOut}
            </h3>
            <p className="text-xs text-theme-text-muted">
              {t.overlays.userSettings.logout.signOutDescription}
            </p>
          </div>
        </div>

        <Button
          onClick={handleLogout}
          variant="destructive"
          className="cursor-pointer w-full"
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-2" />
          )}
          {isSigningOut
            ? t.overlays.userSettings.logout.signingOut
            : t.overlays.userSettings.logout.logOutButton}
        </Button>
      </div>

      <div className="p-4 bg-theme-bg-secondary rounded-lg ">
        <p className="text-xs text-theme-text-light">
          <strong>{t.overlays.userSettings.logout.note}</strong>{" "}
          {t.overlays.userSettings.logout.noteText}
        </p>
      </div>
    </div>
  );
};
