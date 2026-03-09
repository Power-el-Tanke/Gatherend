"use client";

import { LogLevel, setLogLevel } from "livekit-client";

let configured = false;

export function configureLiveKitLogging() {
  if (configured) return;
  configured = true;

  const isDev = process.env.NODE_ENV === "development";

  // LiveKit defaults to INFO which is noisy in production ("publishing track", etc).
  // Keep INFO in dev, suppress it in prod.
  setLogLevel(isDev ? LogLevel.info : LogLevel.warn);
}

