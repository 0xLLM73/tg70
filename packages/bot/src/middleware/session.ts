import { sessionStore } from '../services/session.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * Session middleware for Telegraf
 * Loads and saves session data for each user
 */
export async function sessionMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const userId = ctx.from?.id;
  
  if (!userId) {
    // If no user ID, create empty session
    ctx.session = {
      userId: 0,
      lastActivity: new Date(),
    };
    return next();
  }

  try {
    // Load session data
    ctx.session = await sessionStore.get(userId);
    
    // Update username if available
    if (ctx.from?.username) {
      ctx.session.username = ctx.from.username;
    }
    
    // Call next middleware
    await next();
    
    // Save session data after processing
    await sessionStore.set(userId, ctx.session);
  } catch (error) {
    logger.error('Session middleware error:', error);
    
    // Create fallback session
    ctx.session = {
      userId,
      username: ctx.from?.username,
      lastActivity: new Date(),
    };
    
    await next();
  }
}