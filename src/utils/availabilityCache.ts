import { redis } from '../redis.js';
import type { Slot } from '../services/calendarService.js';

/** Simple wrapper around Redis for caching availability slots */
export class AvailabilityCache {
  private static inMemory = new Map<string, { slots: Slot[]; expiresAt: number }>();

  private static getKey(userId: string, date: string): string {
    return `availability:${userId}:${date}`;
  }

  /** Get cached slots if present and not expired */
  static async get(userId: string, date: string): Promise<Slot[] | null> {
    const key = this.getKey(userId, date);
    try {
      if (redis) {
        const raw = await redis.get(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { slots: Slot[]; ttl: number };
          // redis should have TTL handling, but we double‑check expiration
          if (Date.now() < parsed.ttl) {
            return parsed.slots;
          }
        }
      }
    } catch {
      // fall back to in‑memory cache
    }
    const mem = this.inMemory.get(key);
    if (mem && Date.now() < mem.expiresAt) {
      return mem.slots;
    }
    return null;
  }

  /** Set slots with a TTL (default 5 minutes) */
  static async set(userId: string, date: string, slots: Slot[], ttlMs = 5 * 60 * 1000): Promise<void> {
    const key = this.getKey(userId, date);
    const expiresAt = Date.now() + ttlMs;
    const payload = JSON.stringify({ slots, ttl: expiresAt });
    try {
      if (redis) {
        await redis.set(key, payload, 'PX', ttlMs);
        return;
      }
    } catch {
      // ignore and fallback
    }
    this.inMemory.set(key, { slots, expiresAt });
  }
}
