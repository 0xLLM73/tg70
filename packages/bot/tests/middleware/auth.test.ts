import { 
  authMiddleware, 
  requireRole, 
  addRoleAssertion, 
  ForbiddenError,
  isAdmin,
  isCommunityAdmin,
  getRoleDisplayName 
} from '../../src/middleware/auth.js';
import * as authService from '../../src/services/auth.js';

// Mock the auth service
jest.mock('../../src/services/auth.js');
const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('auth middleware', () => {
  let mockContext: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockContext = createMockBotContext();
    nextFn = jest.fn();
    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
    test('should skip auth for users without telegram ID', async () => {
      mockContext.from = null;
      
      await authMiddleware(mockContext, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(mockedAuthService.getUserByTelegramId).not.toHaveBeenCalled();
    });

    test('should use cached user data if available', async () => {
      const mockUser = createMockSupabaseUser();
      mockContext.session.user = mockUser;
      mockContext.session.userId = 123456789;
      
      await authMiddleware(mockContext, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(mockedAuthService.getUserByTelegramId).not.toHaveBeenCalled();
    });

    test('should load user data from database', async () => {
      const mockUser = createMockSupabaseUser();
      mockedAuthService.getUserByTelegramId.mockResolvedValue(mockUser);
      
      await authMiddleware(mockContext, nextFn);
      
      expect(mockedAuthService.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(mockContext.session.user).toEqual(mockUser);
      expect(nextFn).toHaveBeenCalled();
    });

    test('should log auth event for new session', async () => {
      const mockUser = createMockSupabaseUser();
      mockContext.session.userId = null; // New session
      mockedAuthService.getUserByTelegramId.mockResolvedValue(mockUser);
      mockedAuthService.logAuthEvent.mockResolvedValue();
      
      await authMiddleware(mockContext, nextFn);
      
      expect(mockedAuthService.logAuthEvent).toHaveBeenCalledWith({
        user_id: mockUser.id,
        telegram_id: 123456789,
        event: 'login',
        metadata: {
          username: 'testuser',
          first_name: 'Test',
          timestamp: expect.any(String),
        },
      });
    });

    test('should continue if user not found in database', async () => {
      mockedAuthService.getUserByTelegramId.mockResolvedValue(null);
      
      await authMiddleware(mockContext, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(mockContext.session.user).toBeUndefined();
    });

    test('should handle database errors gracefully', async () => {
      mockedAuthService.getUserByTelegramId.mockRejectedValue(new Error('DB Error'));
      
      await authMiddleware(mockContext, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('requireRole middleware factory', () => {
    test('should allow access for users with required role', async () => {
      const mockUser = createMockSupabaseUser({ role: 'siteAdmin' });
      mockContext.session.user = mockUser;
      mockedAuthService.hasRole.mockReturnValue(true);
      
      const middleware = requireRole('siteAdmin');
      await middleware(mockContext, nextFn);
      
      expect(nextFn).toHaveBeenCalled();
      expect(mockContext.reply).not.toHaveBeenCalled();
    });

    test('should deny access for users without required role', async () => {
      const mockUser = createMockSupabaseUser({ role: 'user' });
      mockContext.session.user = mockUser;
      mockedAuthService.hasRole.mockReturnValue(false);
      
      const middleware = requireRole('siteAdmin');
      await middleware(mockContext, nextFn);
      
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Access denied'),
        expect.any(Object)
      );
    });

    test('should deny access for unauthenticated users', async () => {
      mockContext.session.user = null;
      
      const middleware = requireRole('user');
      await middleware(mockContext, nextFn);
      
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('link your account first'),
        expect.any(Object)
      );
    });

    test('should handle multiple allowed roles', async () => {
      const mockUser = createMockSupabaseUser({ role: 'communityAdmin' });
      mockContext.session.user = mockUser;
      mockedAuthService.hasRole.mockReturnValue(true);
      
      const middleware = requireRole('siteAdmin', 'communityAdmin');
      await middleware(mockContext, nextFn);
      
      expect(mockedAuthService.hasRole).toHaveBeenCalledWith(mockUser, ['siteAdmin', 'communityAdmin']);
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('addRoleAssertion', () => {
    test('should add assertRole method to context', async () => {
      await addRoleAssertion(mockContext, nextFn);
      
      expect(typeof mockContext.assertRole).toBe('function');
      expect(nextFn).toHaveBeenCalled();
    });

    test('assertRole should throw ForbiddenError for unauthorized users', () => {
      mockContext.session.user = null;
      
      addRoleAssertion(mockContext, nextFn);
      
      expect(() => {
        mockContext.assertRole(['siteAdmin']);
      }).toThrow(ForbiddenError);
      expect(() => {
        mockContext.assertRole(['siteAdmin']);
      }).toThrow('Account linking required');
    });

    test('assertRole should throw ForbiddenError for insufficient permissions', () => {
      const mockUser = createMockSupabaseUser({ role: 'user' });
      mockContext.session.user = mockUser;
      mockedAuthService.hasRole.mockReturnValue(false);
      
      addRoleAssertion(mockContext, nextFn);
      
      expect(() => {
        mockContext.assertRole(['siteAdmin']);
      }).toThrow(ForbiddenError);
      expect(() => {
        mockContext.assertRole(['siteAdmin']);
      }).toThrow('Insufficient permissions');
    });

    test('assertRole should pass for authorized users', () => {
      const mockUser = createMockSupabaseUser({ role: 'siteAdmin' });
      mockContext.session.user = mockUser;
      mockedAuthService.hasRole.mockReturnValue(true);
      
      addRoleAssertion(mockContext, nextFn);
      
      expect(() => {
        mockContext.assertRole(['siteAdmin']);
      }).not.toThrow();
    });
  });

  describe('ForbiddenError', () => {
    test('should create error with default message', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Access denied');
      expect(error.name).toBe('ForbiddenError');
    });

    test('should create error with custom message', () => {
      const error = new ForbiddenError('Custom error');
      expect(error.message).toBe('Custom error');
      expect(error.name).toBe('ForbiddenError');
    });
  });

  describe('helper functions', () => {
    test('isAdmin should return true for site admins', () => {
      mockContext.session.user = createMockSupabaseUser({ role: 'siteAdmin' });
      mockedAuthService.hasRole.mockReturnValue(true);
      
      expect(isAdmin(mockContext)).toBe(true);
      expect(mockedAuthService.hasRole).toHaveBeenCalledWith(mockContext.session.user, ['siteAdmin']);
    });

    test('isAdmin should return false for non-admins', () => {
      mockContext.session.user = createMockSupabaseUser({ role: 'user' });
      mockedAuthService.hasRole.mockReturnValue(false);
      
      expect(isAdmin(mockContext)).toBe(false);
    });

    test('isAdmin should handle null user', () => {
      mockContext.session.user = null;
      mockedAuthService.hasRole.mockReturnValue(false);
      
      expect(isAdmin(mockContext)).toBe(false);
      expect(mockedAuthService.hasRole).toHaveBeenCalledWith(null, ['siteAdmin']);
    });

    test('isCommunityAdmin should return true for community admins and site admins', () => {
      mockContext.session.user = createMockSupabaseUser({ role: 'communityAdmin' });
      mockedAuthService.hasRole.mockReturnValue(true);
      
      expect(isCommunityAdmin(mockContext)).toBe(true);
      expect(mockedAuthService.hasRole).toHaveBeenCalledWith(
        mockContext.session.user, 
        ['siteAdmin', 'communityAdmin']
      );
    });

    test('getRoleDisplayName should return proper display names', () => {
      expect(getRoleDisplayName('siteAdmin')).toBe('🔱 Site Administrator');
      expect(getRoleDisplayName('communityAdmin')).toBe('⚡ Community Administrator');
      expect(getRoleDisplayName('user')).toBe('👤 User');
    });

    test('getRoleDisplayName should return the role if not found', () => {
      expect(getRoleDisplayName('unknown' as any)).toBe('unknown');
    });
  });
});