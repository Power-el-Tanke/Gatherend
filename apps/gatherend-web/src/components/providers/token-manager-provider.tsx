"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useSession } from "@/lib/better-auth-client";

type TokenGetter = () => Promise<string | null>;

interface TokenManagerContextValue {
  getToken: TokenGetter;
  isReady: boolean;
}

const TokenGetterContext = createContext<TokenGetter | null>(null);
const TokenReadyContext = createContext<boolean | null>(null);

export function TokenManagerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const isLoaded = !isPending;
  const isSignedIn = Boolean(session?.user?.id);
  const isReady = isLoaded;

  const getToken = useCallback(async (): Promise<string | null> => {
    // BetterAuth in web currently uses cookie-based session for Next routes.
    // Token-based bridge for Express is handled in later migration phase.
    return null;
  }, []);

  const prevRef = useRef<{
    isLoaded: boolean;
    isSignedIn: boolean;
    isReady: boolean;
    getToken: unknown;
  } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    const changed: string[] = [];

    if (!prev || prev.isLoaded !== isLoaded) changed.push("isLoaded");
    if (!prev || prev.isSignedIn !== isSignedIn) changed.push("isSignedIn");
    if (!prev || prev.isReady !== isReady) changed.push("isReady");
    if (!prev || prev.getToken !== getToken) changed.push("getTokenRef");

    prevRef.current = {
      isLoaded,
      isSignedIn,
      isReady,
      getToken,
    };
  }, [getToken, isLoaded, isReady, isSignedIn]);

  return (
    <TokenGetterContext.Provider value={getToken}>
      <TokenReadyContext.Provider value={isReady}>
        {children}
      </TokenReadyContext.Provider>
    </TokenGetterContext.Provider>
  );
}

export function useTokenGetter() {
  const context = useContext(TokenGetterContext);
  if (!context) {
    throw new Error("useTokenGetter must be used within TokenManagerProvider");
  }
  return context;
}

export function useTokenReady() {
  const context = useContext(TokenReadyContext);
  if (context === null) {
    throw new Error("useTokenReady must be used within TokenManagerProvider");
  }
  return context;
}

export function useTokenManager(): TokenManagerContextValue {
  const getToken = useTokenGetter();
  const isReady = useTokenReady();
  return useMemo(() => ({ getToken, isReady }), [getToken, isReady]);
}
