import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from './session.js';
import { logger } from '../utils/logger.js';
import type { BotContext, RateLimitStatus } from '../types/index.js';

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
 * Rate limiter for magic link requests
 * 3 requests per hour per user (email + telegram_id key)
 */
export const magicLinkRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_magic',
  points: 3, // Number of requests
  duration: 3600, // Per 1 hour (3600 seconds)
  blockDuration: 3600, // Block for 1 hour if exceeded
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
 * Check if user can send magic link request
 */
export async function canSendMagicLink(userId: number, email: string): Promise<{
  allowed: boolean;
  remainingPoints: number;
  msBeforeNext: number;
  message?: string;
}> {
  try {
    // Create key combining user ID and email for rate limiting
    const key = `${userId}_${email}`;
    
    const rateLimiterRes = await magicLinkRateLimiter.get(key);
    
    if (!rateLimiterRes) {
      return {
        allowed: true,
        remainingPoints: 3,
        msBeforeNext: 0,
      };
    }
    
    if (rateLimiterRes.remainingPoints <= 0) {
      const minutesLeft = Math.ceil((rateLimiterRes.msBeforeNext || 0) / 60000);
      const hoursLeft = Math.ceil(minutesLeft / 60);
      
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: rateLimiterRes.msBeforeNext || 0,
        message: `🚫 Magic link limit exceeded! You can request up to 3 magic links per hour.\n\nTry again in ${hoursLeft > 1 ? `${hoursLeft} hours` : `${minutesLeft} minutes`}.`,
      };
    }
    
    return {
      allowed: true,
      remainingPoints: rateLimiterRes.remainingPoints || 0,
      msBeforeNext: rateLimiterRes.msBeforeNext || 0,
    };
  } catch (error) {
    logger.error('Error checking magic link rate limit:', error);
    return {
      allowed: false,
      remainingPoints: 0,
      msBeforeNext: 0,
      message: 'Unable to check request limits. Please try again later.',
    };
  }
}

/**
 * Consume magic link rate limit point
 */
export async function consumeMagicLinkRequest(userId: number, email: string): Promise<void> {
  try {
    const key = `${userId}_${email}`;
    await magicLinkRateLimiter.consume(key);
    logger.info(`Magic link request consumed for user ${userId} and email ${email}`);
  } catch (error) {
    logger.error('Error consuming magic link request:', error);
    throw error;
  }
}

/**
 * Get rate limiter status for a user
 */
export async function getRateLimiterStatus(userId: number): Promise<RateLimitStatus> {
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

/**
 * Get magic link rate limiter status for a user and email combination
 */
export async function getMagicLinkRateLimiterStatus(userId: number, email: string): Promise<RateLimitStatus> {
  try {
    const key = `${userId}_${email}`;
    const rateLimiterRes = await magicLinkRateLimiter.get(key);
    
    if (!rateLimiterRes) {
      return {
        totalHits: 0,
        remainingPoints: 3,
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
    logger.error('Error getting magic link rate limiter status:', error);
    return {
      totalHits: 0,
      remainingPoints: 3,
      msBeforeNext: 0,
      isBlocked: false,
    };
  }
}