import { logger } from '../utils/logger.js';
import { getUserByTelegramId, hasRole, logAuthEvent } from '../services/auth.js';
import type { BotContext, UserRole } from '../types/index.js';

/**
 * Custom error for forbidden access
 */
export class ForbiddenError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Authentication middleware
 * Loads user data and attaches to session/context
 */
export async function authMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const telegramUserId = ctx.from?.id;
  
  if (!telegramUserId) {
    return next();
  }

  try {
    // Check if user data is already cached in session
    if (ctx.session.user && ctx.session.userId === telegramUserId) {
      // User data already loaded
      return next();
    }

    // Load user data from database
    const user = await getUserByTelegramId(telegramUserId);
    
    if (user) {
      // Cache user data in session
      ctx.session.user = user;
      
      // Log login event if this is a new session
      if (!ctx.session.userId || ctx.session.userId !== telegramUserId) {
        await logAuthEvent({
          user_id: user.id,
          telegram_id: telegramUserId,
          event: 'login',
          metadata: {
            username: ctx.from?.username,
            first_name: ctx.from?.first_name,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    return next();
  } catch (error) {
    logger.error('Error in auth middleware:', error);
    return next();
  }
}

/**
 * Role guard middleware factory
 * Creates middleware that checks for required roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async function roleGuardMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    const user = ctx.session.user;
    
    if (!user) {
      await ctx.reply(
        '🔐 You need to link your account first!\n\n' +
        'Use /link to connect your Telegram account with your email address.',
        ctx.message?.message_id ? {
          reply_parameters: { message_id: ctx.message.message_id },
        } : {}
      );
      return;
    }

    if (!hasRole(user, allowedRoles)) {
      const roleNames = allowedRoles.join(', ');
      await ctx.reply(
        `🚫 Access denied! This command requires one of the following roles: ${roleNames}\n\n` +
        `Your current role: ${user.role}`,
        ctx.message?.message_id ? {
          reply_parameters: { message_id: ctx.message.message_id },
        } : {}
      );
      
      logger.warn(`Access denied for user ${user.id} (${ctx.from?.username}) - required roles: ${roleNames}, user role: ${user.role}`);
      return;
    }

    return next();
  };
}

/**
 * Add assertRole method to context
 * Allows commands to check roles inline
 */
export function addRoleAssertion(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  ctx.assertRole = (allowedRoles: UserRole[]) => {
    const user = ctx.session.user;
    
    if (!user) {
      throw new ForbiddenError('Account linking required');
    }
    
    if (!hasRole(user, allowedRoles)) {
      const roleNames = allowedRoles.join(', ');
      throw new ForbiddenError(`Insufficient permissions. Required roles: ${roleNames}`);
    }
  };
  
  return next();
}

/**
 * Admin-only middleware
 * Shorthand for requireRole('siteAdmin')
 */
export const requireAdmin = requireRole('siteAdmin');

/**
 * Community admin or site admin middleware
 */
export const requireCommunityAdmin = requireRole('siteAdmin', 'communityAdmin');

/**
 * Any authenticated user (linked account required)
 */
export const requireAuth = requireRole('siteAdmin', 'communityAdmin', 'user');

/**
 * Check if current user is admin
 */
export function isAdmin(ctx: BotContext): boolean {
  return hasRole(ctx.session.user || null, ['siteAdmin']);
}

/**
 * Check if current user is community admin or higher
 */
export function isCommunityAdmin(ctx: BotContext): boolean {
  return hasRole(ctx.session.user || null, ['siteAdmin', 'communityAdmin']);
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames = {
    siteAdmin: '🔱 Site Administrator',
    communityAdmin: '⚡ Community Administrator', 
    user: '👤 User',
  };
  
  return roleNames[role] || role;
}