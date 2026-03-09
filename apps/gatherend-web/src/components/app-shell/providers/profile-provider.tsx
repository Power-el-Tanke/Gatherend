"use client";

import { createContext, useContext } from "react";
import { useCurrentProfile, ClientProfile } from "@/hooks/use-current-profile";
import { GatherendOutlineSVG } from "@/lib/gatherend-outline";

const ProfileContext = createContext<ClientProfile | null>(null);

export function useProfile(): ClientProfile {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useCurrentProfile();

  if (isLoading || !profile) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-theme-bg-tertiary">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-theme-border-primary" />
          <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-2 text-theme-accent-light animate-pulse" />
        </div>
        <p className="text-[18px] text-theme-text-accent">Loading profile...</p>
      </div>
    );
  }

  // CRÍTICO: profile está garantizado ser definido aquí (por el guard anterior)
  return (
    <ProfileContext.Provider value={profile}>
      {children}
    </ProfileContext.Provider>
  );
}
