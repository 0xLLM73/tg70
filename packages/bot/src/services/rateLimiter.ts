import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from './session.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * Rate limiter for user messages
 * 30 requests per minute per user
 */
export const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_msg',
  points: 30, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if exceeded
});

/**
 * Rate limiter middleware for Telegraf
 */
export async function rateLimiterMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const userId = ctx.from?.id;
  
  if (!userId) {
    return next();
  }

  try {
    await rateLimiter.consume(userId);
    return next();
  } catch (rateLimiterRes) {
    // Rate limit exceeded
    const username = ctx.from?.username || ctx.from?.first_name || 'User';
    logger.warn(`Rate limit exceeded for user ${username} (${userId})`);
    
    // Send rate limit message
    await ctx.reply(
      '🚦 Slow down there! You can send up to 30 messages per minute.\n\n' +
      'Please wait a moment before sending another message.',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
    
    return;
  }
}

/**
 * Get rate limiter status for a user
 */
export async function getRateLimiterStatus(userId: number): Promise<{
  totalHits: number;
  remainingPoints: number;
  msBeforeNext: number;
  isBlocked: boolean;
}> {
  try {
    const rateLimiterRes = await rateLimiter.get(userId);
    
    if (!rateLimiterRes) {
      return {
        totalHits: 0,
        remainingPoints: 30,
        msBeforeNext: 0,
        isBlocked: false,
      };
    }
    
    return {
      totalHits: (rateLimiterRes as any).totalHits || 0,
      remainingPoints: rateLimiterRes.remainingPoints || 0,
      msBeforeNext: rateLimiterRes.msBeforeNext || 0,
      isBlocked: (rateLimiterRes.remainingPoints || 0) === 0,
    };
  } catch (error) {
    logger.error('Error getting rate limiter status:', error);
    return {
      totalHits: 0,
      remainingPoints: 30,
      msBeforeNext: 0,
      isBlocked: false,
    };
  }
}