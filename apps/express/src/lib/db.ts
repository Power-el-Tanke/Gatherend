import { PrismaClient } from "@prisma/client";

const isDevelopment = process.env.NODE_ENV !== "production";

declare global {
  // eslint-disable-next-line no-var
  var prismaExpress: PrismaClient | undefined;
}

export const db =
  globalThis.prismaExpress ||
  new PrismaClient({
    log: isDevelopment ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (isDevelopment) globalThis.prismaExpress = db;

// Graceful shutdown
process.on("beforeExit", async () => {
  await db.$disconnect();
});
