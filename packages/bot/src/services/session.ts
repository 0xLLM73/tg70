import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { SessionData } from '../types/index.js';

/**
 * Redis client instance
 */
export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

/**
 * Session store class
 */
export class SessionStore {
  private readonly prefix = 'session:';
  private readonly ttl = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Generate session key for user
   */
  private getKey(userId: number): string {
    return `${this.prefix}${userId}`;
  }

  /**
   * Get session data for user
   */
  async get(userId: number): Promise<SessionData> {
    try {
      const key = this.getKey(userId);
      const data = await redis.get(key);
      
      if (data) {
        const session = JSON.parse(data);
        // Convert lastActivity back to Date object
        session.lastActivity = new Date(session.lastActivity);
        return session;
      }
      
      // Return default session
      return {
        userId,
        lastActivity: new Date(),
      };
    } catch (error) {
      logger.error('Error getting session:', error);
      return {
        userId,
        lastActivity: new Date(),
      };
    }
  }

  /**
   * Set session data for user
   */
  async set(userId: number, session: SessionData): Promise<void> {
    try {
      const key = this.getKey(userId);
      session.lastActivity = new Date();
      
      await redis.setex(key, this.ttl, JSON.stringify(session));
    } catch (error) {
      logger.error('Error setting session:', error);
    }
  }

  /**
   * Delete session for user
   */
  async delete(userId: number): Promise<void> {
    try {
      const key = this.getKey(userId);
      await redis.del(key);
    } catch (error) {
      logger.error('Error deleting session:', error);
    }
  }

  /**
   * Clear all sessions
   */
  async clear(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('Error clearing sessions:', error);
    }
  }
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    logger.info('✅ Redis connection successful');
    return true;
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
}

/**
 * Global session store instance
 */
export const sessionStore = new SessionStore();