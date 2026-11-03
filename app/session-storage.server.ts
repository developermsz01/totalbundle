import { Session } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { PrismaClient } from "@prisma/client";

// Global memory cache to persist sessions across warm serverless invocations or when DB is not configured
declare global {
  var __memorySessions: Map<string, any> | undefined;
}

const memoryStore = globalThis.__memorySessions || new Map<string, any>();
globalThis.__memorySessions = memoryStore;

export function createResilientSessionStorage(prisma: PrismaClient) {
  let prismaStorage: PrismaSessionStorage | null = null;

  if (process.env.DATABASE_URL) {
    try {
      prismaStorage = new PrismaSessionStorage(prisma, {
        connectionRetries: 1,
        connectionRetryIntervalMs: 1000,
      });
    } catch (err) {
      console.warn("[ResilientSessionStorage] Could not initialize PrismaSessionStorage:", err);
      prismaStorage = null;
    }
  }

  return {
    async storeSession(session: Session): Promise<boolean> {
      try {
        const raw = session.toObject();
        memoryStore.set(session.id, raw);

        if (prismaStorage) {
          try {
            await prismaStorage.storeSession(session);
          } catch (dbErr) {
            console.warn("[ResilientSessionStorage] Failed to persist session to database, using memory cache:", dbErr);
          }
        }
        return true;
      } catch (e) {
        console.error("[ResilientSessionStorage] Error storing session:", e);
        return false;
      }
    },

    async loadSession(id: string): Promise<Session | undefined> {
      try {
        if (prismaStorage) {
          try {
            const dbSession = await prismaStorage.loadSession(id);
            if (dbSession) {
              memoryStore.set(id, dbSession.toObject());
              return dbSession;
            }
          } catch (dbErr) {
            console.warn("[ResilientSessionStorage] Database query failed, checking memory cache:", dbErr);
          }
        }

        const cached = memoryStore.get(id);
        if (cached) {
          return new Session(cached);
        }
        return undefined;
      } catch (e) {
        console.error("[ResilientSessionStorage] Error loading session:", e);
        const cached = memoryStore.get(id);
        return cached ? new Session(cached) : undefined;
      }
    },

    async deleteSession(id: string): Promise<boolean> {
      memoryStore.delete(id);
      if (prismaStorage) {
        try {
          await prismaStorage.deleteSession(id);
        } catch {}
      }
      return true;
    },

    async deleteSessions(ids: string[]): Promise<boolean> {
      for (const id of ids) {
        memoryStore.delete(id);
      }
      if (prismaStorage) {
        try {
          await prismaStorage.deleteSessions(ids);
        } catch {}
      }
      return true;
    },

    async findSessionsByShop(shop: string): Promise<Session[]> {
      try {
        if (prismaStorage) {
          try {
            const sessions = await prismaStorage.findSessionsByShop(shop);
            if (sessions && sessions.length > 0) return sessions;
          } catch (dbErr) {
            console.warn("[ResilientSessionStorage] DB query failed, falling back to memory:", dbErr);
          }
        }

        const results: Session[] = [];
        for (const raw of memoryStore.values()) {
          if (raw.shop === shop) {
            results.push(new Session(raw));
          }
        }
        return results;
      } catch (e) {
        console.error("[ResilientSessionStorage] Error finding sessions by shop:", e);
        return [];
      }
    },

    async isReady(): Promise<boolean> {
      return true;
    },
  };
}
