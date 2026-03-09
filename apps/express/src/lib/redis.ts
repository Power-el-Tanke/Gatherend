/**
 * Redis Client Configuration
 *
 * Provides Redis clients for:
 * - Socket.IO adapter (pub/sub for horizontal scaling)
 * - Caching layer
 * - Presence management
 * - Rate limiting
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "./logger.js";

// Redis clients
let redisClient: RedisClientType | null = null;
let redisSubscriber: RedisClientType | null = null;

// Connection state
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * Initialize Redis clients
 */
export async function initializeRedis(): Promise<boolean> {
  if (!isRedisConfigured()) {
    logger.warn("REDIS_URL not configured - running without Redis");
    return false;
  }

  try {
    const redisUrl = process.env.REDIS_URL!;

    // Create main client
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > MAX_RECONNECT_ATTEMPTS) {
            logger.error("Redis max reconnection attempts reached");
            return new Error("Max reconnection attempts reached");
          }
          const delay = Math.min(retries * 100, 3000);
          logger.info(`Redis reconnecting in ${delay}ms...`);
          return delay;
        },
      },
    });

    // Create subscriber client (duplicate for pub/sub)
    redisSubscriber = redisClient.duplicate();

    // Set up event handlers
    redisClient.on("error", (err) => {
      logger.error("Redis client error:", err);
      isConnected = false;
    });

    redisClient.on("ready", () => {
      logger.info("Redis client ready");
      isConnected = true;
      connectionAttempts = 0;
    });

    redisClient.on("reconnecting", () => {
      connectionAttempts++;
      logger.info(`Redis reconnecting (attempt ${connectionAttempts})`);
    });

    redisSubscriber.on("error", (err) => {
      logger.error("Redis subscriber error:", err);
    });

    // Connect both clients
    await Promise.all([redisClient.connect(), redisSubscriber.connect()]);

    isConnected = true;
    logger.info("Redis clients initialized successfully");
    return true;
  } catch (error) {
    logger.error("Failed to initialize Redis:", error);
    redisClient = null;
    redisSubscriber = null;
    isConnected = false;
    return false;
  }
}

/**
 * Get the main Redis client
 * @throws Error if Redis is not initialized
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error("Redis client not initialized");
  }
  return redisClient;
}

/**
 * Get the subscriber Redis client (for Socket.IO adapter)
 * @throws Error if Redis is not initialized
 */
export function getRedisSubscriber(): RedisClientType {
  if (!redisSubscriber) {
    throw new Error("Redis subscriber not initialized");
  }
  return redisSubscriber;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Gracefully close Redis connections
 */
export async function closeRedis(): Promise<void> {
  try {
    if (redisSubscriber) {
      await redisSubscriber.quit();
      logger.info("Redis subscriber closed");
    }
    if (redisClient) {
      await redisClient.quit();
      logger.info("Redis client closed");
    }
    isConnected = false;
    redisClient = null;
    redisSubscriber = null;
  } catch (error) {
    logger.error("Error closing Redis connections:", error);
  }
}
