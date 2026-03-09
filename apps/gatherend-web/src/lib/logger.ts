// A simple logger utility.

const isDev = process.env.NODE_ENV === "development";

function shouldLogNonErrors(): boolean {
  return isDev;
}

export const logger = {
  log: (...args: unknown[]) => {
    if (shouldLogNonErrors()) console.log(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args); 
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  debug: (...args: unknown[]) => {
    if (shouldLogNonErrors()) console.log(...args);
  },
  // Server-side only logging 
  server: (...args: unknown[]) => {
    if (shouldLogNonErrors() && typeof window === "undefined") {
      console.log("[SERVER]", ...args);
    }
  },
};
