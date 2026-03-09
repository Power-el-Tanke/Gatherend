// Simple logger: be verbose in any non-production env.
// In local dev, NODE_ENV is often undefined unless explicitly set.
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  info: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  error: (...args: any[]) => {
    console.error(...args); // Always log errors
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  debug: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
};
