import { Context } from 'telegraf';

/**
 * User session data interface
 */
export interface SessionData {
  userId: number;
  username?: string;
  step?: string;
  data?: Record<string, any>;
  lastActivity: Date;
}

/**
 * Custom bot context with session support
 */
export interface BotContext extends Context {
  session: SessionData;
}

/**
 * Environment variables interface
 */
export interface EnvConfig {
  BOT_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  REDIS_URL: string;
  PORT: number;
  NODE_ENV: string;
  WEBHOOK_URL?: string;
}

/**
 * Health check response interface
 */
export interface HealthCheckResponse {
  status: string;
  uptime: string;
  version: string;
  timestamp: string;
}

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  points: number;
  duration: number;
}

/**
 * Supabase user record
 */
export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
  updated_at: string;
}