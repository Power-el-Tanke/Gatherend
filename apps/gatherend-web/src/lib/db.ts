import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const isDevelopment = process.env.NODE_ENV !== "production";

logger.server("[DB] Initializing database client...");
logger.server("[DB] Environment:", process.env.NODE_ENV);
logger.server("[DB] DATABASE_URL exists:", !!process.env.DATABASE_URL);

declare global {
  var prisma: PrismaClient | undefined;
}

export const db =
  globalThis.prisma ||
  new PrismaClient({
    ...(isDevelopment ? { log: ["query"] } : {}),
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (!process.env.DATABASE_URL) {
  logger.error("[DB] ERROR: DATABASE_URL is not defined!");
}

logger.server("[DB] Client initialized");

if (isDevelopment) globalThis.prisma = db;
