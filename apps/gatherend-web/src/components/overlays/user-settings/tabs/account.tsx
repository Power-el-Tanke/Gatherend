"use client";

import type { ClientProfile } from "@/hooks/use-current-profile";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";

interface AccountTabProps {
  user: ClientProfile;
  onClose: () => void;
  setOverlayBlocking: (value: boolean) => void;
}

export const AccountTab = ({ user, onClose, setOverlayBlocking }: AccountTabProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isRedirectingResetPassword, setIsRedirectingResetPassword] = useState(false);
  const [closeOnRouteChange, setCloseOnRouteChange] = useState(false);

  useEffect(() => {
    if (!closeOnRouteChange) return;
    if (pathname === "/create-password") {
      onClose();
    }
  }, [closeOnRouteChange, onClose, pathname]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-theme-text-primary">
          {t.overlays.userSettings.account.title}
        </h2>
        <p className="text-sm text-theme-text-tertiary">
          {t.overlays.userSettings.account.subtitle}
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-theme-border-primary bg-theme-bg-secondary p-4">
          <div className="flex items-center gap-2 text-theme-text-tertiary text-xs uppercase tracking-wide mb-2">
            Your username dah .-.
          </div>
          <p className="text-theme-text-primary font-medium">
            {user.username}#{user.discriminator}
          </p>
        </div>

        <div className="rounded-lg border border-theme-border-primary bg-theme-bg-secondary p-4">
          <div className="flex items-center gap-2 text-theme-text-tertiary text-xs uppercase tracking-wide mb-2">
            Your email (Keep it private!)
          </div>
          <p className="text-theme-text-primary break-all">{user.email}</p>
        </div>

        <div className="rounded-lg border border-theme-border-primary bg-theme-bg-secondary p-4">
          <div className="flex items-center gap-2 text-theme-text-tertiary text-xs uppercase tracking-wide mb-2">
            Security
          </div>
          <p className="text-sm text-theme-text-tertiary mb-3">
            Manage your password from the password recovery flow.
          </p>
          <Link
            href={`/create-password?email=${encodeURIComponent(user.email)}`}
            onClick={(e) => {
              if (isRedirectingResetPassword) {
                e.preventDefault();
                return;
              }

              if (
                e.defaultPrevented ||
                e.button !== 0 ||
                e.metaKey ||
                e.altKey ||
                e.ctrlKey ||
                e.shiftKey
                ) {
                return;
              }

              setIsRedirectingResetPassword(true);
              setOverlayBlocking(true);
              setCloseOnRouteChange(true);
            }}
            aria-disabled={isRedirectingResetPassword}
            className={
              isRedirectingResetPassword
                ? "inline-flex items-center text-sm text-[#109e92] opacity-70 pointer-events-none"
                : "inline-flex items-center text-sm text-[#109e92] hover:underline"
            }
          >
            {isRedirectingResetPassword ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isRedirectingResetPassword
              ? t.overlays.userSettings.account.redirecting
              : t.auth.resetPassword}
          </Link>
        </div>
      </div>
    </div>
  );
};
