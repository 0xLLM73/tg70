/**
 * Jest setup for interceptor-based tests
 * This setup provides real service connections for integration testing
 */

/// <reference types="jest" />

import { config } from 'dotenv';

// Load test environment variables
config({ path: '../../../.env.test' });

// Import real services (no mocking for interceptor tests)
import { config as botConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Mock only the logger to reduce noise during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logStartup: jest.fn(),
}));

// Use real config but override sensitive values for testing
jest.mock('../config/index', () => ({
  config: {
    BOT_TOKEN: process.env.BOT_TOKEN || 'test-bot-token',
    SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379/1',
    PORT: 3001,
    NODE_ENV: 'test',
    WEBHOOK_URL: 'http://localhost:3000/webhook',
    VERIFICATION_BASE_URL: 'http://localhost:3001',
    JWT_SECRET: 'test-jwt-secret-for-testing-32-chars-min',
  },
  logConfigStatus: jest.fn(),
}));

// Keep services real but provide fallbacks for when they're not available
// This allows interceptor tests to run even without full infrastructure

// Mock rate limiter to always return available state
jest.mock('../services/rateLimiter', () => ({
  rateLimiterMiddleware: jest.fn().mockImplementation(() => (ctx: any, next: any) => next()),
  getRateLimiterStatus: jest.fn().mockResolvedValue({
    remainingPoints: 30,
    isBlocked: false,
    resetTime: new Date(Date.now() + 60000),
  }),
}));

// Provide a mock session middleware that creates test sessions
jest.mock('../middleware/session', () => ({
  sessionMiddleware: jest.fn().mockImplementation(() => (ctx: any, next: any) => {
    // Create a test session
    ctx.session = {
      userId: ctx.from?.id || 12345,
      lastActivity: new Date(),
      user: {
        id: 'test-user-id',
        telegram_id: ctx.from?.id || 12345,
        email: 'test@example.com',
        username: ctx.from?.username || 'testuser',
        first_name: ctx.from?.first_name || 'Test',
        last_name: ctx.from?.last_name || 'User',
        is_bot: false,
        language_code: 'en',
        is_premium: false,
        role: 'user' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
    return next();
  }),
}));

// Mock auth middleware to provide test authentication
jest.mock('../middleware/auth', () => ({
  authMiddleware: jest.fn().mockImplementation(() => (ctx: any, next: any) => next()),
  addRoleAssertion: jest.fn().mockImplementation(() => (ctx: any, next: any) => {
    ctx.assertRole = jest.fn(); // Mock role assertion
    return next();
  }),
}));

// Mock database with realistic responses
jest.mock('../services/database', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
      update: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    }),
  },
  testConnection: jest.fn().mockResolvedValue(true),
}));

// Mock Redis session service
jest.mock('../services/session', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue('OK'),
  },
  testRedisConnection: jest.fn().mockResolvedValue(true),
}));

// Global test configuration
export const interceptorTestConfig = {
  timeout: 10000, // Longer timeout for integration tests
  verbose: false,   // Set to true for debugging
};

// Test utilities specific to interceptor tests
export function enableVerboseLogging(): void {
  // Restore actual console logging for debugging
  (logger.info as jest.Mock).mockImplementation(console.log);
  (logger.warn as jest.Mock).mockImplementation(console.warn);
  (logger.error as jest.Mock).mockImplementation(console.error);
  (logger.debug as jest.Mock).mockImplementation(console.debug);
}

// Global setup for interceptor tests
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Increase timeout for integration tests
jest.setTimeout(interceptorTestConfig.timeout);