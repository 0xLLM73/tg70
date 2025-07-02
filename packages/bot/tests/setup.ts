import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_bot_token_123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key';
process.env.SUPABASE_ANON_KEY = 'test_anon_key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.VERIFICATION_BASE_URL = 'https://test-verification.com';
process.env.JWT_SECRET = 'test-jwt-secret-key-32-characters-long';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers
jest.useFakeTimers();

// Global test helpers
global.createMockTelegramUser = (overrides = {}) => ({
  id: 123456789,
  is_bot: false,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  language_code: 'en',
  ...overrides,
});

global.createMockSupabaseUser = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  telegram_id: 123456789,
  username: 'testuser',
  first_name: 'Test',
  last_name: 'User',
  role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  last_login_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

global.createMockBotContext = (overrides = {}) => ({
  from: createMockTelegramUser(),
  message: {
    message_id: 1,
    text: '/test',
    date: Date.now() / 1000,
    chat: { id: 123456789, type: 'private' },
    from: createMockTelegramUser(),
  },
  session: {
    userId: 123456789,
    username: 'testuser',
    lastActivity: new Date(),
    step: undefined,
    data: {},
    user: undefined,
  },
  reply: jest.fn().mockResolvedValue({}),
  telegram: {
    sendMessage: jest.fn().mockResolvedValue({}),
  },
  assertRole: jest.fn(),
  ...overrides,
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});