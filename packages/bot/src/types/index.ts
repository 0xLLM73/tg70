import type { Context } from 'telegraf';

/**
 * User roles for access control
 */
export type UserRole = 'siteAdmin' | 'communityAdmin' | 'user';

/**
 * Auth event types for audit logging
 */
export type AuthEventType = 'login' | 'link' | 'unlink' | 'role_change';

/**
 * User database record
 */
export interface User {
  id: string;
  telegram_id?: number;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_bot: boolean;
  language_code?: string;
  is_premium: boolean;
  role: UserRole;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Auth event database record
 */
export interface AuthEvent {
  id: number;
  user_id: string;
  telegram_id?: number;
  event: AuthEventType;
  ip?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Session data stored in Redis
 */
export interface SessionData {
  userId: number;
  username?: string;
  lastActivity: Date;
  step?: string;
  data?: Record<string, any>;
  user?: User; // Cached user data with role
  linkingEmail?: string; // Email being linked during magic link flow
  linkingToken?: string; // Temporary token for verification
  linkingExpiry?: Date; // When the linking process expires
  communityCreation?: {
    step: 1 | 2 | 3 | 4 | 5;
    data: {
      slug?: string;
      name?: string;
      description?: string;
      is_private?: boolean;
    };
  };
}

/**
 * Magic link verification payload
 */
export interface MagicLinkPayload {
  telegram_id: number;
  email: string;
  exp: number;
  iat: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  remainingPoints: number;
  isBlocked: boolean;
  totalHits: number;
  msBeforeNext: number;
}

/**
 * Custom bot context with session support and user data
 */
export interface BotContext extends Context {
  session: SessionData;
  assertRole?: (allowedRoles: UserRole[]) => void;
}

/**
 * Environment variables interface
 */
export interface EnvConfig {
  BOT_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  REDIS_URL: string;
  PORT: number;
  NODE_ENV: string;
  WEBHOOK_URL?: string;
  VERIFICATION_BASE_URL: string;
  JWT_SECRET?: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  uptime: string;
  version: string;
  timestamp: string;
  services?: {
    database: 'connected' | 'error';
    redis: 'connected' | 'error';
  };
  environment?: string;
}

/**
 * API response types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;  
  message?: string;
}

/**
 * Magic link request payload
 */
export interface MagicLinkRequest {
  telegram_id: number;
  email: string;
  username?: string;
  first_name?: string;
}

/**
 * Link verification request
 */
export interface LinkVerificationRequest {
  access_token: string;
  telegram_id: number;
}

/**
 * Email validation result
 */
export interface EmailValidation {
  isValid: boolean;
  normalizedEmail?: string;
  error?: string;
}