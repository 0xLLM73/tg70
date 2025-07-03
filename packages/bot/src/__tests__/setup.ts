/**
 * Jest test setup configuration
 * This file runs before each test suite
 */

/// <reference types="jest" />

import { config } from 'dotenv';

// Load test environment variables
config({ path: '../../../.env.test' });

// Mock config module to prevent validation errors during tests
jest.mock('../config/index', () => ({
  config: {
    BOT_TOKEN: 'test-bot-token',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    REDIS_URL: 'redis://localhost:6379/1',
    PORT: 3001,
    NODE_ENV: 'test',
    WEBHOOK_URL: 'http://localhost:3000/webhook',
    VERIFICATION_BASE_URL: 'http://localhost:3001',
    JWT_SECRET: 'test-jwt-secret-for-testing-32-chars-min',
  },
  logConfigStatus: jest.fn(),
}));

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

// We'll set up the database mock after defining testSupabase

// Test database configuration
export const testConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
};

// Mock test data store
const mockStore: Record<string, any[]> = {
  users: [],
  communities: [],
  community_members: [],
  posts: [],
  comments: [],
  votes: [],
  jobs: [],
  job_applications: [],
  auth_events: [],
};

// Generate UUID-like IDs for tests
function generateMockUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Mock query builder
class MockQueryBuilder {
  private table: string;
  private selectColumns: string;
  private filters: { column: string; value: any }[] = [];
  
  constructor(table: string) {
    this.table = table;
    this.selectColumns = '*';
  }
  
  select(columns = '*') {
    this.selectColumns = columns;
    return this;
  }
  
  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }
  
  single() {
    const items = mockStore[this.table] || [];
    let filtered = items;
    
    // Apply all filters
    for (const filter of this.filters) {
      filtered = filtered.filter(item => item[filter.column] === filter.value);
    }
    
    const item = filtered[0] || null;
    return Promise.resolve({ 
      data: item, 
      error: item ? null : { code: 'PGRST116' } 
    });
  }
  
  // Add support for non-terminal operations that return filtered results
  where(conditions: Record<string, any>) {
    for (const [column, value] of Object.entries(conditions)) {
      this.filters.push({ column, value });
    }
    return this;
  }
}

// Mock insert builder
class MockInsertBuilder {
  private table: string;
  private data: any;
  
  constructor(table: string, data: any) {
    this.table = table;
    this.data = data;
  }
  
  select() {
    return this;
  }
  
  single() {
    return this.executeInsert();
  }
  
  // Handle direct insert calls (without .select().single())
  then(onResolve: any, onReject?: any) {
    return this.executeInsert().then(onResolve, onReject);
  }
  
  private executeInsert() {
    const newItem = {
      id: generateMockUuid(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...this.data,
    };
    
    // Add defaults based on table
    if (this.table === 'communities') {
      newItem.member_count = 1;
      newItem.post_count = 0;
      newItem.settings = {};
    }
    if (this.table === 'community_members') {
      newItem.joined_at = new Date().toISOString();
    }
    
    mockStore[this.table] = mockStore[this.table] || [];
    mockStore[this.table].push(newItem);
    return Promise.resolve({ data: newItem, error: null });
  }
}

// Mock delete builder
class MockDeleteBuilder {
  private table: string;
  
  constructor(table: string) {
    this.table = table;
  }
  
  eq(column: string, value: any) {
    const items = mockStore[this.table] || [];
    const initialLength = items.length;
    mockStore[this.table] = items.filter(item => item[column] !== value);
    return Promise.resolve({ 
      data: null, 
      error: mockStore[this.table].length !== initialLength ? null : new Error('No rows deleted')
    });
  }
  
  neq(column: string, value: any) {
    const items = mockStore[this.table] || [];
    const initialLength = items.length;
    mockStore[this.table] = items.filter(item => item[column] !== value);
    return Promise.resolve({ 
      data: null, 
      error: mockStore[this.table].length !== initialLength ? null : new Error('No rows deleted')
    });
  }
}

// Mock Supabase client for tests
export const testSupabase = {
  from: (table: string) => ({
    select: (columns = '*') => new MockQueryBuilder(table).select(columns),
    insert: (data: any) => new MockInsertBuilder(table, data),
    delete: () => new MockDeleteBuilder(table),
  }),
};

// Mock the database service after testSupabase is defined
jest.mock('../services/database', () => ({
  supabase: testSupabase,
  testConnection: jest.fn().mockResolvedValue(true),
}));

// Test data cleanup utilities
export async function cleanupTestData(): Promise<void> {
  try {
    // Clear all mock data
    Object.keys(mockStore).forEach(table => {
      mockStore[table] = [];
    });
  } catch (error) {
    console.warn('Warning: Test cleanup failed:', error);
  }
}

// Debug helper to inspect mock store (for development)
export function debugMockStore() {
  console.log('Mock Store Contents:', JSON.stringify(mockStore, null, 2));
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
    throw new Error(`Failed to create test user: ${error.message || error}`);
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
    throw new Error(`Failed to create test community: ${error.message || error}`);
  }

  // Add creator as admin member
  await testSupabase
    .from('community_members')
    .insert({
      community_id: data.id,
      user_id: userId,
      role: 'admin',
      status: 'active',
    })
    .select()
    .single();

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