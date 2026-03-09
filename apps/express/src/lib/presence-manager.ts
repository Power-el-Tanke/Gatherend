import { logger } from "./logger.js";
import {
  getRedisClient,
  getRedisSubscriber,
  isRedisConfigured,
  isRedisConnected,
} from "./redis.js";
import type { RedisClientType } from "redis";
import { Server } from "socket.io";

interface UserPresence {
  socketId: string;
  connectedAt: string;
  serverId: string;
  lastHeartbeat: string;
}

// TTL para la presencia en segundos (2 minutos - da tiempo para reconexiones)
const PRESENCE_TTL = 120;
// Prefijo para las keys de presencia
const PRESENCE_PREFIX = "presence:";
// Key para el set de usuarios online
const ONLINE_USERS_SET = "presence:online_users";

// Generar un ID único para esta instancia del servidor
const SERVER_ID = `server:${process.pid}:${Date.now()}`;

/**
 * Maneja el estado de presencia de usuarios usando Redis
 * Soporta escalado horizontal con múltiples instancias del servidor
 *
 * Arquitectura de heartbeat:
 * - Cliente envía heartbeat cada 45-60s via WebSocket
 * - Servidor renueva TTL en Redis (120s)
 * - Si no hay heartbeat, Redis key expira
 * - Redis Keyspace Notifications detecta expiración → emite user-offline
 *
 * NOTA: Usa los clientes Redis compartidos de redis.ts para evitar
 * conexiones duplicadas.
 */
export class PresenceManager {
  private fallbackOnlineUsers: Map<string, UserPresence> = new Map();
  private fallbackHeartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private serverHeartbeatInterval: NodeJS.Timeout | null = null;
  private io: Server | null = null; // Referencia a Socket.IO para emitir eventos
  private keyspaceSubscribed: boolean = false;

  /**
   * Configura la referencia a Socket.IO para emitir eventos
   */
  setSocketIO(io: Server): void {
    this.io = io;
  }

  /**
   * Helper para obtener el cliente Redis de forma segura
   */
  private getRedis(): RedisClientType | null {
    if (!isRedisConfigured() || !isRedisConnected()) {
      return null;
    }
    try {
      return getRedisClient();
    } catch {
      return null;
    }
  }

  /**
   * Inicializa el PresenceManager después de que Redis esté listo
   * Debe llamarse después de initializeRedis() en server.ts
   */
  async initialize(): Promise<void> {
    if (!isRedisConfigured()) {
      logger.warn(
        "REDIS_URL not configured, using in-memory presence (not suitable for production)",
      );
      return;
    }

    // Configurar Keyspace Notifications para detectar expiración de keys
    await this.setupKeyspaceNotifications();

    // Iniciar heartbeat del servidor para mantener presencia actualizada
    this.startServerHeartbeat();

    logger.info("PresenceManager initialized with shared Redis clients");
  }

  /**
   * Configura Redis Keyspace Notifications para detectar cuando una key expira
   * Esto permite emitir user-offline solo cuando el TTL realmente expira
   */
  private async setupKeyspaceNotifications(): Promise<void> {
    if (this.keyspaceSubscribed) return;

    const redis = this.getRedis();
    if (!redis) return;

    try {
      // Habilitar notificaciones para eventos de expiración (Ex = expired events)
      await redis.configSet("notify-keyspace-events", "Ex");

      // Usar el subscriber compartido para Keyspace Notifications
      const subscriber = getRedisSubscriber();

      // Suscribirse a eventos de expiración en la base de datos 0
      await subscriber.pSubscribe(
        "__keyevent@0__:expired",
        async (expiredKey) => {
          try {
            // Solo procesar keys de presencia
            if (!expiredKey.startsWith(PRESENCE_PREFIX)) return;
            if (expiredKey === ONLINE_USERS_SET) return;

            const profileId = expiredKey.replace(PRESENCE_PREFIX, "");

            // Remover del set de usuarios online
            const client = this.getRedis();
            if (client) {
              await client.sRem(ONLINE_USERS_SET, profileId);
            }

            // Emitir evento de offline a todos los clientes
            if (this.io) {
              this.io.emit("presence:user-offline", {
                profileId,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (error) {
            logger.error(`Error processing expired key ${expiredKey}:`, error);
          }
        },
      );

      this.keyspaceSubscribed = true;
      logger.info(
        "Redis Keyspace Notifications configured for presence expiration",
      );
    } catch (error) {
      logger.error("Failed to setup Keyspace Notifications:", error);
      // No es crítico - el sistema sigue funcionando, solo no emitirá user-offline automáticamente
    }
  }

  /**
   * Heartbeat del servidor para renovar TTL de usuarios conectados a esta instancia
   * (Backup en caso de que los heartbeats de clientes no lleguen)
   */
  private startServerHeartbeat(): void {
    if (this.serverHeartbeatInterval) {
      clearInterval(this.serverHeartbeatInterval);
    }

    // Renovar presencia cada 60 segundos (menos que el TTL de 120s)
    this.serverHeartbeatInterval = setInterval(async () => {
      const redis = this.getRedis();
      if (!redis) return;

      try {
        // Usar SCAN en lugar de KEYS para no bloquear Redis
        let cursor = "0";
        do {
          const result = await redis.scan(cursor, {
            MATCH: `${PRESENCE_PREFIX}*`,
            COUNT: 100,
          });
          cursor = result.cursor.toString();

          for (const key of result.keys) {
            if (key === ONLINE_USERS_SET) continue;

            const data = await redis.get(key);
            if (data && typeof data === "string") {
              const presence = JSON.parse(data) as UserPresence;
              if (presence.serverId === SERVER_ID) {
                await redis.expire(key, PRESENCE_TTL);
              }
            }
          }
        } while (cursor !== "0");
      } catch (error) {
        logger.error("Server heartbeat error:", error);
      }
    }, 60000); // 60 segundos
  }

  /**
   * Marca un usuario como online cuando se conecta
   */
  async userConnected(profileId: string, socketId: string): Promise<void> {
    const presence: UserPresence = {
      socketId,
      connectedAt: new Date().toISOString(),
      serverId: SERVER_ID,
      lastHeartbeat: new Date().toISOString(),
    };

    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${PRESENCE_PREFIX}${profileId}`;

        // Usar multi para operaciones atómicas
        await redis
          .multi()
          .setEx(key, PRESENCE_TTL, JSON.stringify(presence))
          .sAdd(ONLINE_USERS_SET, profileId)
          .exec();
      } catch (error) {
        logger.error("Redis userConnected error:", error);
        // Fallback a memoria
        this.fallbackOnlineUsers.set(profileId, presence);
        this.setupFallbackHeartbeatTimer(profileId);
      }
    } else {
      this.fallbackOnlineUsers.set(profileId, presence);
      this.setupFallbackHeartbeatTimer(profileId);
    }
  }

  /**
   * Renueva el TTL de presencia cuando el cliente envía heartbeat
   * Este es el método principal para mantener usuarios online
   */
  async renewPresence(profileId: string, socketId: string): Promise<void> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${PRESENCE_PREFIX}${profileId}`;
        const data = await redis.get(key);

        if (data && typeof data === "string") {
          const presence = JSON.parse(data) as UserPresence;
          // Actualizar lastHeartbeat y socketId (puede haber cambiado en reconexión)
          presence.lastHeartbeat = new Date().toISOString();
          presence.socketId = socketId;

          // Renovar con nuevo TTL
          await redis.setEx(key, PRESENCE_TTL, JSON.stringify(presence));
        } else {
          // Key no existe, crear nueva (usuario se reconectó)
          await this.userConnected(profileId, socketId);
        }
      } catch (error) {
        logger.error("Redis renewPresence error:", error);
        // Fallback
        this.renewFallbackPresence(profileId, socketId);
      }
    } else {
      this.renewFallbackPresence(profileId, socketId);
    }
  }

  /**
   * Configura timer de expiración para fallback en memoria
   */
  private setupFallbackHeartbeatTimer(profileId: string): void {
    // Limpiar timer existente si hay
    const existingTimer = this.fallbackHeartbeatTimers.get(profileId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Crear nuevo timer que expirará si no hay heartbeat
    const timer = setTimeout(() => {
      this.handleFallbackExpiration(profileId);
    }, PRESENCE_TTL * 1000);

    this.fallbackHeartbeatTimers.set(profileId, timer);
  }

  /**
   * Renueva presencia en fallback de memoria
   */
  private renewFallbackPresence(profileId: string, socketId: string): void {
    const existing = this.fallbackOnlineUsers.get(profileId);
    if (existing) {
      existing.lastHeartbeat = new Date().toISOString();
      existing.socketId = socketId;
      this.setupFallbackHeartbeatTimer(profileId); // Renovar timer
    } else {
      // No existe, crear
      this.userConnected(profileId, socketId);
    }
  }

  /**
   * Maneja expiración en fallback de memoria
   */
  private handleFallbackExpiration(profileId: string): void {
    const wasOnline = this.fallbackOnlineUsers.has(profileId);
    this.fallbackOnlineUsers.delete(profileId);
    this.fallbackHeartbeatTimers.delete(profileId);

    if (wasOnline && this.io) {
      this.io.emit("presence:user-offline", {
        profileId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Fuerza el estado offline de un usuario inmediatamente
   * Usado para: cierre de página (última tab) o logout explícito
   */
  async forceOffline(profileId: string): Promise<void> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${PRESENCE_PREFIX}${profileId}`;

        // Eliminar key de presencia y del set de usuarios online
        await redis.multi().del(key).sRem(ONLINE_USERS_SET, profileId).exec();
      } catch (error) {
        logger.error("Redis forceOffline error:", error);
        this.forceFallbackOffline(profileId);
      }
    } else {
      this.forceFallbackOffline(profileId);
    }

    // Emitir evento de offline inmediatamente
    if (this.io) {
      this.io.emit("presence:user-offline", {
        profileId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Fuerza offline en fallback de memoria
   */
  private forceFallbackOffline(profileId: string): void {
    this.fallbackOnlineUsers.delete(profileId);
    const timer = this.fallbackHeartbeatTimers.get(profileId);
    if (timer) {
      clearTimeout(timer);
      this.fallbackHeartbeatTimers.delete(profileId);
    }
  }

  /**
   * Verifica si un usuario está online
   */
  async isOnline(profileId: string): Promise<boolean> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${PRESENCE_PREFIX}${profileId}`;
        const exists = await redis.exists(key);
        return exists === 1;
      } catch (error) {
        logger.error("Redis isOnline error:", error);
        return this.fallbackOnlineUsers.has(profileId);
      }
    }
    return this.fallbackOnlineUsers.has(profileId);
  }

  /**
   * Obtiene la lista de usuarios online de un array de IDs
   */
  async getOnlineUsers(profileIds: string[]): Promise<string[]> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const multi = redis.multi();
        profileIds.forEach((id) => {
          multi.exists(`${PRESENCE_PREFIX}${id}`);
        });

        const results = await multi.exec();

        return profileIds.filter((_, index) => {
          const result = results?.[index];
          return Number(result) === 1;
        });
      } catch (error) {
        logger.error("Redis getOnlineUsers error:", error);
        return profileIds.filter((id) => this.fallbackOnlineUsers.has(id));
      }
    }
    return profileIds.filter((id) => this.fallbackOnlineUsers.has(id));
  }

  /**
   * Obtiene todos los usuarios online
   */
  async getAllOnlineUsers(): Promise<string[]> {
    const redis = this.getRedis();
    if (redis) {
      try {
        return await redis.sMembers(ONLINE_USERS_SET);
      } catch (error) {
        logger.error("Redis getAllOnlineUsers error:", error);
        return Array.from(this.fallbackOnlineUsers.keys());
      }
    }
    return Array.from(this.fallbackOnlineUsers.keys());
  }

  /**
   * Obtiene el socketId de un usuario
   */
  async getSocketId(profileId: string): Promise<string | undefined> {
    const redis = this.getRedis();
    if (redis) {
      try {
        const key = `${PRESENCE_PREFIX}${profileId}`;
        const data = await redis.get(key);

        if (data && typeof data === "string") {
          const presence = JSON.parse(data) as UserPresence;
          return presence.socketId;
        }
        return undefined;
      } catch (error) {
        logger.error("Redis getSocketId error:", error);
        return this.fallbackOnlineUsers.get(profileId)?.socketId;
      }
    }
    return this.fallbackOnlineUsers.get(profileId)?.socketId;
  }

  /**
   * Obtiene el total de usuarios conectados
   */
  async getOnlineCount(): Promise<number> {
    const redis = this.getRedis();
    if (redis) {
      try {
        return await redis.sCard(ONLINE_USERS_SET);
      } catch (error) {
        logger.error("Redis getOnlineCount error:", error);
        return this.fallbackOnlineUsers.size;
      }
    }
    return this.fallbackOnlineUsers.size;
  }

  /**
   * Obtiene información de presencia de múltiples usuarios
   */
  async getPresenceInfo(
    profileIds: string[],
  ): Promise<Record<string, boolean>> {
    const presenceMap: Record<string, boolean> = {};

    const redis = this.getRedis();
    if (redis) {
      try {
        const multi = redis.multi();
        profileIds.forEach((id) => {
          multi.exists(`${PRESENCE_PREFIX}${id}`);
        });

        const results = await multi.exec();

        profileIds.forEach((id, index) => {
          const result = results?.[index];
          presenceMap[id] = Number(result) === 1;
        });
      } catch (error) {
        logger.error("Redis getPresenceInfo error:", error);
        profileIds.forEach((id) => {
          presenceMap[id] = this.fallbackOnlineUsers.has(id);
        });
      }
    } else {
      profileIds.forEach((id) => {
        presenceMap[id] = this.fallbackOnlineUsers.has(id);
      });
    }

    return presenceMap;
  }

  /**
   * Limpia recursos al cerrar el servidor
   */
  async cleanup(): Promise<void> {
    if (this.serverHeartbeatInterval) {
      clearInterval(this.serverHeartbeatInterval);
    }

    // Limpiar timers de fallback
    for (const timer of this.fallbackHeartbeatTimers.values()) {
      clearTimeout(timer);
    }
    this.fallbackHeartbeatTimers.clear();

    // Nota: No cerramos los clientes Redis aquí porque son compartidos
    // El cierre se hace en redis.ts -> closeRedis()

    const redis = this.getRedis();
    if (redis) {
      // Eliminar presencia de usuarios de esta instancia usando SCAN
      try {
        let cursor = "0";
        do {
          const result = await redis.scan(cursor, {
            MATCH: `${PRESENCE_PREFIX}*`,
            COUNT: 100,
          });
          cursor = result.cursor.toString();

          for (const key of result.keys) {
            if (key === ONLINE_USERS_SET) continue;
            const data = await redis.get(key);
            if (data && typeof data === "string") {
              const presence = JSON.parse(data) as UserPresence;
              if (presence.serverId === SERVER_ID) {
                const profileId = key.replace(PRESENCE_PREFIX, "");
                await redis.del(key);
                await redis.sRem(ONLINE_USERS_SET, profileId);
              }
            }
          }
        } while (cursor !== "0");
      } catch (error) {
        logger.error("Error cleaning up presence:", error);
      }
    }
  }
}

// Singleton instance
export const presenceManager = new PresenceManager();
