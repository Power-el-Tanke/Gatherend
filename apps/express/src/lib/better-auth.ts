import { db } from "./db.js";

type BetterAuthInstance = {
  api: {
    getSession: (input: { headers: Headers }) => Promise<any>;
  };
};

let cachedAuth: BetterAuthInstance | null = null;
const isDevelopment = process.env.NODE_ENV === "development";

function normalizeOrigins(origins: Array<string | undefined>): string[] {
  return Array.from(new Set(origins.filter((o): o is string => Boolean(o))));
}

export async function getBetterAuth(): Promise<BetterAuthInstance> {
  if (cachedAuth) return cachedAuth;

  // better-auth is ESM; load dynamically from our CJS build.
  const [{ betterAuth }, { prismaAdapter }] = await Promise.all([
    import("better-auth"),
    import("better-auth/adapters/prisma"),
  ]);

  const trustedOrigins = normalizeOrigins([
    process.env.BETTER_AUTH_URL,
    process.env.FRONTEND_URL,
    ...(isDevelopment ? ["http://localhost:3000"] : []),
  ]);

  cachedAuth = betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins,
    // Express only needs session validation; keep config minimal.
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: true, window: 60, max: 30 },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  }) as unknown as BetterAuthInstance;

  return cachedAuth;
}

export function toHeaders(
  input: Record<string, string | string[] | undefined>,
): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(","));
    }
  }
  return headers;
}
