import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { 
  User, 
  AuthEvent, 
  AuthEventType, 
  MagicLinkPayload, 
  MagicLinkRequest,
  ApiResponse,
  UserRole 
} from '../types/index.js';

/**
 * Supabase client for auth operations (uses anon key for magic links)
 */
const supabaseAuth = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

/**
 * Supabase client with service role for admin operations
 */
const supabaseAdmin = createClient(
  config.SUPABASE_URL, 
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Send magic link to user's email
 */
export async function sendMagicLink(request: MagicLinkRequest): Promise<ApiResponse> {
  try {
    logger.info(`Sending magic link to ${request.email} for Telegram user ${request.telegram_id}`);
    
    // Create verification URL with embedded data
    const verificationUrl = `${config.VERIFICATION_BASE_URL}/verify?telegram_id=${request.telegram_id}&username=${encodeURIComponent(request.username || '')}&first_name=${encodeURIComponent(request.first_name || '')}`;
    
    // Send magic link using Supabase Auth
    const { data, error } = await supabaseAuth.auth.signInWithOtp({
      email: request.email,
      options: {
        emailRedirectTo: verificationUrl,
        data: {
          telegram_id: request.telegram_id,
          username: request.username,
          first_name: request.first_name,
        },
      },
    });

    if (error) {
      logger.error('Failed to send magic link:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    logger.info(`Magic link sent successfully to ${request.email}`);
    return {
      success: true,
      data: {
        message: 'Magic link sent to your email',
        user: data.user,
      },
    };
  } catch (error) {
    logger.error('Error sending magic link:', error);
    return {
      success: false,
      error: 'Failed to send magic link',
    };
  }
}

/**
 * Verify JWT token from magic link
 */
export async function verifyAccessToken(token: string): Promise<ApiResponse<User>> {
  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Invalid access token:', error?.message);
      return {
        success: false,
        error: 'Invalid or expired access token',
      };
    }

    logger.info(`Access token verified for user: ${user.email}`);
    return {
      success: true,
      data: user as any, // Type assertion for compatibility
    };
  } catch (error) {
    logger.error('Error verifying access token:', error);
    return {
      success: false,
      error: 'Token verification failed',
    };
  }
}

/**
 * Link Telegram user to Supabase user account
 */
export async function linkTelegramUser(
  supabaseUserId: string,
  telegramId: number,
  email: string,
  metadata?: {
    username?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<ApiResponse<User>> {
  try {
    // Check if telegram_id is already linked to another account
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('Error checking existing Telegram link:', checkError);
      return {
        success: false,
        error: 'Failed to check existing links',
      };
    }

    if (existingUser && existingUser.id !== supabaseUserId) {
      logger.warn(`Telegram ID ${telegramId} already linked to different account`);
      return {
        success: false,
        error: 'This Telegram account is already linked to another email address',
      };
    }

    // Update or create user record with telegram_id
    const { data: user, error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: supabaseUserId,
        telegram_id: telegramId,
        email,
        username: metadata?.username,
        first_name: metadata?.first_name,
        last_name: metadata?.last_name,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (upsertError) {
      logger.error('Error linking Telegram user:', upsertError);
      
      // Handle unique constraint violation
      if (upsertError.code === '23505') {
        return {
          success: false,
          error: 'This Telegram account is already linked to another email address',
        };
      }
      
      return {
        success: false,
        error: 'Failed to link Telegram account',
      };
    }

    // Log auth event
    await logAuthEvent({
      user_id: supabaseUserId,
      telegram_id: telegramId,
      event: 'link',
      metadata: {
        email,
        username: metadata?.username,
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`Successfully linked Telegram ${telegramId} to user ${supabaseUserId}`);
    return {
      success: true,
      data: user,
      message: 'Telegram account successfully linked!',
    };
  } catch (error) {
    logger.error('Error in linkTelegramUser:', error);
    return {
      success: false,
      error: 'Failed to link Telegram account',
    };
  }
}

/**
 * Get user by telegram_id with role information
 */
export async function getUserByTelegramId(telegramId: number): Promise<User | null> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // User not found
      }
      logger.error('Error fetching user by telegram_id:', error);
      return null;
    }

    return user;
  } catch (error) {
    logger.error('Error in getUserByTelegramId:', error);
    return null;
  }
}

/**
 * Update user role (admin operation)
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole,
  adminUserId?: string
): Promise<ApiResponse> {
  try {
    // Update user role
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      return {
        success: false,
        error: 'Failed to update user role',
      };
    }

    // Log role change event
    await logAuthEvent({
      user_id: targetUserId,
      telegram_id: user.telegram_id,
      event: 'role_change',
      metadata: {
        new_role: newRole,
        changed_by: adminUserId,
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`Updated user ${targetUserId} role to ${newRole}`);
    return {
      success: true,
      data: user,
      message: `Role updated to ${newRole}`,
    };
  } catch (error) {
    logger.error('Error in updateUserRole:', error);
    return {
      success: false,
      error: 'Failed to update role',
    };
  }
}

/**
 * Log authentication/authorization events for audit
 */
export async function logAuthEvent(event: Omit<AuthEvent, 'id' | 'created_at'>): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('auth_events')
      .insert({
        user_id: event.user_id,
        telegram_id: event.telegram_id,
        event: event.event,
        ip: event.ip,
        user_agent: event.user_agent,
        metadata: event.metadata,
      });

    if (error) {
      logger.error('Failed to log auth event:', error);
    }
  } catch (error) {
    logger.error('Error logging auth event:', error);
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: User | null, requiredRoles: UserRole[]): boolean {
  if (!user) return false;
  return requiredRoles.includes(user.role);
}

/**
 * Get user's link status
 */
export async function getLinkStatus(telegramId: number): Promise<{
  isLinked: boolean;
  user?: User;
  email?: string;
}> {
  try {
    const user = await getUserByTelegramId(telegramId);
    
    return {
      isLinked: !!user?.email,
      user: user || undefined,
      email: user?.email,
    };
  } catch (error) {
    logger.error('Error getting link status:', error);
    return { isLinked: false };
  }
}