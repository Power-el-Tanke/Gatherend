"use client";

import { useSocketClient } from "@/components/providers/socket-provider";
import { signOut } from "@/lib/better-auth-client";

export function SignOutButton() {
  const { goOffline } = useSocketClient();

  const handleSignOut = async () => {
    goOffline();
    await signOut();
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleSignOut}
      className="px-6 py-2 bg-theme-button-primary hover:bg-theme-button-hover text-theme-text-light rounded-lg transition-colors text-sm"
    >
      Sign Out
    </button>
  );
}
