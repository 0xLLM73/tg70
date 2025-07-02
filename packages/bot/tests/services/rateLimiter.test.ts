import { 
  canSendMagicLink, 
  consumeMagicLinkRequest, 
  getRateLimiterStatus,
  getMagicLinkRateLimiterStatus,
  rateLimiterMiddleware 
} from '../../src/services/rateLimiter.js';

// Mock the Redis client and rate limiter
jest.mock('rate-limiter-flexible');
jest.mock('../services/session.js');

describe('rateLimiter', () => {
  let mockContext: any;
  let nextFn: jest.Mock;
  let mockRateLimiterRes: any;

  beforeEach(() => {
    mockContext = createMockBotContext();
    nextFn = jest.fn();
    mockRateLimiterRes = {
      remainingPoints: 2,
      msBeforeNext: 0,
      totalHits: 1,
    };
    jest.clearAllMocks();
  });

  describe('magic link rate limiting', () => {
    describe('canSendMagicLink', () => {
      test('should allow magic link for new user/email combination', async () => {
        // Mock magicLinkRateLimiter.get to return null (no previous requests)
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(null),
        };

        const result = await canSendMagicLink(123456, 'test@example.com');

        expect(result.allowed).toBe(true);
        expect(result.remainingPoints).toBe(3);
        expect(result.msBeforeNext).toBe(0);
        expect(result.message).toBeUndefined();
      });

      test('should allow magic link when user has remaining points', async () => {
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(mockRateLimiterRes),
        };

        const result = await canSendMagicLink(123456, 'test@example.com');

        expect(result.allowed).toBe(true);
        expect(result.remainingPoints).toBe(2);
        expect(result.msBeforeNext).toBe(0);
      });

      test('should block magic link when rate limit exceeded', async () => {
        const blockedRes = {
          remainingPoints: 0,
          msBeforeNext: 3600000, // 1 hour
          totalHits: 3,
        };

        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(blockedRes),
        };

        const result = await canSendMagicLink(123456, 'test@example.com');

        expect(result.allowed).toBe(false);
        expect(result.remainingPoints).toBe(0);
        expect(result.message).toContain('Magic link limit exceeded');
        expect(result.message).toContain('3 magic links per hour');
      });

      test('should handle rate limiter errors gracefully', async () => {
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockRejectedValue(new Error('Redis error')),
        };

        const result = await canSendMagicLink(123456, 'test@example.com');

        expect(result.allowed).toBe(false);
        expect(result.message).toContain('Unable to check request limits');
        expect(console.error).toHaveBeenCalled();
      });

      test('should create correct rate limiting key', async () => {
        const mockGet = jest.fn().mockResolvedValue(null);
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: mockGet,
        };

        await canSendMagicLink(123456, 'test@example.com');

        expect(mockGet).toHaveBeenCalledWith('123456_test@example.com');
      });

      test('should show correct time remaining for blocked requests', async () => {
        const blockedRes = {
          remainingPoints: 0,
          msBeforeNext: 7200000, // 2 hours
          totalHits: 3,
        };

        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(blockedRes),
        };

        const result = await canSendMagicLink(123456, 'test@example.com');

        expect(result.message).toContain('2 hours');
      });

      test('should show minutes when less than 1 hour remaining', async () => {
        const blockedRes = {
          remainingPoints: 0,
          msBeforeNext: 1800000, // 30 minutes
          totalHits: 3,
        };

        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(blockedRes),
        };

        const result = await canSendMagicLink(123456, 'test@example.com');

        expect(result.message).toContain('30 minutes');
      });
    });

    describe('consumeMagicLinkRequest', () => {
      test('should consume rate limit point successfully', async () => {
        const mockConsume = jest.fn().mockResolvedValue({});
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          consume: mockConsume,
        };

        await consumeMagicLinkRequest(123456, 'test@example.com');

        expect(mockConsume).toHaveBeenCalledWith('123456_test@example.com');
      });

      test('should handle consume errors', async () => {
        const mockConsume = jest.fn().mockRejectedValue(new Error('Rate limit exceeded'));
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          consume: mockConsume,
        };

        await expect(consumeMagicLinkRequest(123456, 'test@example.com')).rejects.toThrow();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('getMagicLinkRateLimiterStatus', () => {
      test('should return default status for new user/email', async () => {
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(null),
        };

        const status = await getMagicLinkRateLimiterStatus(123456, 'test@example.com');

        expect(status).toEqual({
          totalHits: 0,
          remainingPoints: 3,
          msBeforeNext: 0,
          isBlocked: false,
        });
      });

      test('should return actual status when rate limiter data exists', async () => {
        const mockData = {
          remainingPoints: 1,
          msBeforeNext: 1000,
          totalHits: 2,
        };

        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(mockData),
        };

        const status = await getMagicLinkRateLimiterStatus(123456, 'test@example.com');

        expect(status).toEqual({
          totalHits: 2,
          remainingPoints: 1,
          msBeforeNext: 1000,
          isBlocked: false,
        });
      });

      test('should indicate blocked status when no points remaining', async () => {
        const mockData = {
          remainingPoints: 0,
          msBeforeNext: 3600000,
          totalHits: 3,
        };

        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockResolvedValue(mockData),
        };

        const status = await getMagicLinkRateLimiterStatus(123456, 'test@example.com');

        expect(status.isBlocked).toBe(true);
      });

      test('should handle errors gracefully', async () => {
        require('../../src/services/rateLimiter.js').magicLinkRateLimiter = {
          get: jest.fn().mockRejectedValue(new Error('Redis error')),
        };

        const status = await getMagicLinkRateLimiterStatus(123456, 'test@example.com');

        expect(status).toEqual({
          totalHits: 0,
          remainingPoints: 3,
          msBeforeNext: 0,
          isBlocked: false,
        });
      });
    });
  });

  describe('general rate limiting', () => {
    describe('rateLimiterMiddleware', () => {
      test('should allow request when under rate limit', async () => {
        require('../../src/services/rateLimiter.js').rateLimiter = {
          consume: jest.fn().mockResolvedValue({}),
        };

        await rateLimiterMiddleware(mockContext, nextFn);

        expect(nextFn).toHaveBeenCalled();
        expect(mockContext.reply).not.toHaveBeenCalled();
      });

      test('should block request when rate limit exceeded', async () => {
        require('../../src/services/rateLimiter.js').rateLimiter = {
          consume: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
        };

        await rateLimiterMiddleware(mockContext, nextFn);

        expect(nextFn).not.toHaveBeenCalled();
        expect(mockContext.reply).toHaveBeenCalledWith(
          expect.stringContaining('Slow down there'),
          expect.any(Object)
        );
      });

      test('should skip rate limiting for users without ID', async () => {
        mockContext.from = null;

        await rateLimiterMiddleware(mockContext, nextFn);

        expect(nextFn).toHaveBeenCalled();
      });

      test('should use correct user ID for rate limiting', async () => {
        const mockConsume = jest.fn().mockResolvedValue({});
        require('../../src/services/rateLimiter.js').rateLimiter = {
          consume: mockConsume,
        };

        await rateLimiterMiddleware(mockContext, nextFn);

        expect(mockConsume).toHaveBeenCalledWith(123456789);
      });
    });

    describe('getRateLimiterStatus', () => {
      test('should return default status for new user', async () => {
        require('../../src/services/rateLimiter.js').rateLimiter = {
          get: jest.fn().mockResolvedValue(null),
        };

        const status = await getRateLimiterStatus(123456);

        expect(status).toEqual({
          totalHits: 0,
          remainingPoints: 30,
          msBeforeNext: 0,
          isBlocked: false,
        });
      });

      test('should return actual status when data exists', async () => {
        const mockData = {
          remainingPoints: 25,
          msBeforeNext: 30000,
          totalHits: 5,
        };

        require('../../src/services/rateLimiter.js').rateLimiter = {
          get: jest.fn().mockResolvedValue(mockData),
        };

        const status = await getRateLimiterStatus(123456);

        expect(status).toEqual({
          totalHits: 5,
          remainingPoints: 25,
          msBeforeNext: 30000,
          isBlocked: false,
        });
      });

      test('should indicate blocked status when no points remaining', async () => {
        const mockData = {
          remainingPoints: 0,
          msBeforeNext: 60000,
          totalHits: 30,
        };

        require('../../src/services/rateLimiter.js').rateLimiter = {
          get: jest.fn().mockResolvedValue(mockData),
        };

        const status = await getRateLimiterStatus(123456);

        expect(status.isBlocked).toBe(true);
      });

      test('should handle errors gracefully', async () => {
        require('../../src/services/rateLimiter.js').rateLimiter = {
          get: jest.fn().mockRejectedValue(new Error('Redis error')),
        };

        const status = await getRateLimiterStatus(123456);

        expect(status).toEqual({
          totalHits: 0,
          remainingPoints: 30,
          msBeforeNext: 0,
          isBlocked: false,
        });
      });
    });
  });
});