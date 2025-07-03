/**
 * Jest test setup configuration
 * This file runs before each test suite
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load test environment variables
config({ path: '../../../.env.test' });

// Mock Winston logger to avoid console spam during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logStartup: jest.fn(),
}));

// Mock Redis to avoid external dependencies in tests
jest.mock('../services/session', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    quit: jest.fn(),
  },
  testRedisConnection: jest.fn().mockResolvedValue(true),
}));

// Test database configuration
export const testConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
};

// Test Supabase client (bypasses RLS)
export const testSupabase = createClient(
  testConfig.SUPABASE_URL,
  testConfig.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Test data cleanup utilities
export async function cleanupTestData(): Promise<void> {
  try {
    // Clean up in reverse dependency order
    await testSupabase.from('job_applications').delete().neq('id', '');
    await testSupabase.from('jobs').delete().neq('id', '');
    await testSupabase.from('votes').delete().neq('user_id', '');
    await testSupabase.from('comments').delete().neq('id', '');
    await testSupabase.from('posts').delete().neq('id', '');
    await testSupabase.from('community_members').delete().neq('user_id', '');
    await testSupabase.from('communities').delete().neq('id', '');
    await testSupabase.from('auth_events').delete().neq('id', '0');
    await testSupabase.from('users').delete().neq('id', '');
  } catch (error) {
    console.warn('Warning: Test cleanup failed:', error);
  }
}

// Test user factory
export async function createTestUser(overrides: Partial<any> = {}): Promise<any> {
  const userData = {
    telegram_id: Math.floor(Math.random() * 1000000),
    username: `testuser_${Date.now()}`,
    first_name: 'Test',
    last_name: 'User',
    email: `test_${Date.now()}@example.com`,
    role: 'user',
    ...overrides,
  };

  const { data, error } = await testSupabase
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data;
}

// Test community factory
export async function createTestCommunity(userId: string, overrides: Partial<any> = {}): Promise<any> {
  const communityData = {
    slug: `test-community-${Date.now()}`,
    name: `Test Community ${Date.now()}`,
    description: 'A test community',
    creator_id: userId,
    is_private: false,
    ...overrides,
  };

  const { data, error } = await testSupabase
    .from('communities')
    .insert(communityData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test community: ${error.message}`);
  }

  // Add creator as admin member
  await testSupabase
    .from('community_members')
    .insert({
      community_id: data.id,
      user_id: userId,
      role: 'admin',
      status: 'active',
    });

  return data;
}

// Test post factory
export async function createTestPost(communityId: string, authorId: string, overrides: Partial<any> = {}): Promise<any> {
  const postData = {
    community_id: communityId,
    author_id: authorId,
    title: `Test Post ${Date.now()}`,
    content: {
      type: 'text',
      data: 'This is a test post content',
    },
    ...overrides,
  };

  const { data, error } = await testSupabase
    .from('posts')
    .insert(postData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test post: ${error.message}`);
  }

  return data;
}

// Mock Telegram context for testing
export function createMockContext(user?: any): any {
  return {
    message: {
      message_id: 123,
      text: '/test',
      from: {
        id: user?.telegram_id || 12345,
        first_name: user?.first_name || 'Test',
        username: user?.username || 'testuser',
      },
    },
    from: {
      id: user?.telegram_id || 12345,
      first_name: user?.first_name || 'Test',
      username: user?.username || 'testuser',
    },
    session: {
      user: user || null,
    },
    reply: jest.fn(),
    replyWithHTML: jest.fn(),
    answerCbQuery: jest.fn(),
    editMessageText: jest.fn(),
    telegram: {
      sendMessage: jest.fn(),
    },
    assertRole: jest.fn(),
  };
}

// Global test setup
beforeEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup test data
  await cleanupTestData();
});

// Increase timeout for database operations
jest.setTimeout(30000);