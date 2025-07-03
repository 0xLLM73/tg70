/**
 * Bot Commands Tests
 * Tests for all community-related bot commands
 */

import { communitiesCommand, handleCommunitiesCallback, handleCommunitiesSearch } from '../commands/communities.js';
import { createCommunityCommand, handleCommunityCreationFlow } from '../commands/createCommunity.js';
import { joinCommand, parseJoinCommand } from '../commands/join.js';
import { createTestUser, createTestCommunity, cleanupTestData } from './setup.js';
import { BotContext } from '../types/index.js';

// Mock context factory
function createMockContext(overrides: Partial<BotContext> = {}): BotContext {
  const mockContext: BotContext = {
    reply: jest.fn().mockResolvedValue({ message_id: 123 }),
    editMessageText: jest.fn().mockResolvedValue(true),
    deleteMessage: jest.fn().mockResolvedValue(true),
    answerCbQuery: jest.fn().mockResolvedValue(true),
    session: {
      userId: 123,
      lastActivity: new Date(),
      user: {
        id: 'test-user-id',
        telegram_id: 123,
        email: 'test@example.com',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        is_bot: false,
        language_code: 'en',
        is_premium: false,
        role: 'user' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      communitiesPage: 0,
      communitiesSort: 'newest' as const,
      communitiesSearch: undefined,
      communitiesWaitingForSearch: false,
    },
    from: {
      id: 123,
      is_bot: false,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
    },
    message: {
      message_id: 456,
      date: Date.now() / 1000,
      chat: { id: 789, type: 'private' },
      from: {
        id: 123,
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      },
      text: '/test',
    },
    callbackQuery: undefined,
    ...overrides,
  } as any;

  return mockContext;
}

describe('Bot Commands', () => {
  beforeEach(async () => {
    await cleanupTestData();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('/communities command', () => {
    it('should require authentication', async () => {
      const ctx = createMockContext({
        session: { userId: 123, lastActivity: new Date() } as any,
      });

      await communitiesCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('🔐 Please authenticate first using /start');
    });

    it('should show empty communities list when no communities exist', async () => {
      const ctx = createMockContext();

      await communitiesCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🏘️ **Community Discovery**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    it('should display communities when they exist', async () => {
      const ctx = createMockContext();
      
      // Create test user and community
      const user = await createTestUser();
      await createTestCommunity(user.id, {
        slug: 'test-community',
        name: 'Test Community',
        description: 'A test community',
        is_private: false,
      });

      await communitiesCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Test Community'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    it('should initialize session data correctly', async () => {
      const ctx = createMockContext();

      await communitiesCommand(ctx);

      expect(ctx.session).toEqual(
        expect.objectContaining({
          communitiesPage: 0,
          communitiesSort: 'newest',
          communitiesSearch: undefined,
        })
      );
    });
  });

  describe('/create_community command', () => {
    it('should require authentication', async () => {
      const ctx = createMockContext({
        session: { userId: 123, lastActivity: new Date() } as any,
      });

      await createCommunityCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('� You need to link your account first'),
        expect.any(Object)
      );
    });

    it('should start community creation wizard', async () => {
      const ctx = createMockContext();

      await createCommunityCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🏗️ **Create New Community**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_parameters: expect.any(Object),
        })
      );
    });

    it('should initialize creation session data', async () => {
      const ctx = createMockContext();

      await createCommunityCommand(ctx);

      expect(ctx.session).toEqual(
        expect.objectContaining({
          communityCreation: {
            step: 1,
            data: {},
          },
        })
      );
    });
  });

  describe('/join command', () => {
    it('should require authentication', async () => {
      const ctx = createMockContext({
        session: { userId: 123, lastActivity: new Date() } as any,
      });

      await joinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('� You need to link your account first'),
        expect.any(Object)
      );
    });

    it('should show usage when no slug provided', async () => {
      const ctx = createMockContext();

      await joinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📝 **Join a Community**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
        })
      );
    });

    it('should validate slug format', async () => {
      const ctx = createMockContext();

      await joinCommand(ctx, 'Invalid-Slug');

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ **Invalid Community Slug**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
        })
      );
    });

    it('should handle non-existent community', async () => {
      const ctx = createMockContext();

      await joinCommand(ctx, 'non-existent');

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🤷‍♂️ **Community Not Found**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
        })
      );
    });

    it('should join public community successfully', async () => {
      const ctx = createMockContext();
      
      // Create test community
      const creator = await createTestUser();
      await createTestCommunity(creator.id, {
        slug: 'public-test',
        name: 'Public Test Community',
        is_private: false,
      });

      await joinCommand(ctx, 'public-test');

      // Should show loading message first
      expect(ctx.reply).toHaveBeenCalledWith('🔄 Joining community...');
      
      // Should delete loading message
      expect(ctx.deleteMessage).toHaveBeenCalledWith(123);
      
      // Should show success message
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🎉 **Welcome to Public Test Community!**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    it('should handle private community join request', async () => {
      const ctx = createMockContext();
      
      // Create test private community
      const creator = await createTestUser();
      await createTestCommunity(creator.id, {
        slug: 'private-test',
        name: 'Private Test Community',
        is_private: true,
      });

      await joinCommand(ctx, 'private-test');

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📋 **Join Request Submitted**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    it('should detect existing membership', async () => {
      const ctx = createMockContext();
      
      // Create test community and make user a member
      const creator = await createTestUser();
      const community = await createTestCommunity(creator.id, {
        slug: 'existing-member',
        name: 'Existing Member Test',
        is_private: false,
      });

             // User is already creator/admin, so should detect existing membership
       const adminCtx = createMockContext({
         session: {
           ...ctx.session,
           user: { 
             ...ctx.session?.user!,
             id: creator.id,
           },
         },
       });

      await joinCommand(adminCtx, 'existing-member');

      expect(adminCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ **Already a Member**'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('parseJoinCommand helper', () => {
    it('should extract slug from join command', () => {
      expect(parseJoinCommand('/join test-community')).toBe('test-community');
      expect(parseJoinCommand('/join crypto-traders')).toBe('crypto-traders');
      expect(parseJoinCommand('/join web3_builders')).toBe('web3_builders');
    });

    it('should handle commands without slug', () => {
      expect(parseJoinCommand('/join')).toBeUndefined();
      expect(parseJoinCommand('/join ')).toBeUndefined();
    });

    it('should handle multiple spaces', () => {
      expect(parseJoinCommand('/join  test-community  ')).toBe('test-community');
    });

    it('should convert to lowercase', () => {
      expect(parseJoinCommand('/join Test-Community')).toBe('test-community');
    });
  });

  describe('Callback handlers', () => {
    describe('Communities callbacks', () => {
      it('should require authentication', async () => {
        const ctx = createMockContext({
          session: { userId: 123, lastActivity: new Date() } as any,
          callbackQuery: { data: 'communities_next' } as any,
        });

        await handleCommunitiesCallback(ctx);

        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Please authenticate first');
      });

      it('should handle pagination next', async () => {
        const ctx = createMockContext({
          callbackQuery: { data: 'communities_next' } as any,
        });

        await handleCommunitiesCallback(ctx);

        expect(ctx.editMessageText).toHaveBeenCalledWith('🔄 Loading...', { parse_mode: 'Markdown' });
        expect(ctx.answerCbQuery).toHaveBeenCalled();
      });

      it('should handle pagination previous', async () => {
        const ctx = createMockContext({
          callbackQuery: { data: 'communities_prev' } as any,
        });
        
        // Set page > 0 so previous is available
        ctx.session.communitiesPage = 2;

        await handleCommunitiesCallback(ctx);

        expect(ctx.editMessageText).toHaveBeenCalledWith('🔄 Loading...', { parse_mode: 'Markdown' });
        expect(ctx.answerCbQuery).toHaveBeenCalled();
      });

      it('should handle sort changes', async () => {
        const ctx = createMockContext({
          callbackQuery: { data: 'communities_sort_popular' } as any,
        });

        await handleCommunitiesCallback(ctx);

        expect(ctx.editMessageText).toHaveBeenCalledWith('🔄 Loading...', { parse_mode: 'Markdown' });
        expect(ctx.answerCbQuery).toHaveBeenCalled();
        expect(ctx.session).toEqual(
          expect.objectContaining({
            communitiesSort: 'popular',
            communitiesPage: 0, // Should reset to first page
          })
        );
      });

      it('should handle search initiation', async () => {
        const ctx = createMockContext({
          callbackQuery: { data: 'communities_search' } as any,
        });

        await handleCommunitiesCallback(ctx);

        expect(ctx.editMessageText).toHaveBeenCalledWith(
          expect.stringContaining('🔍 **Search Communities**'),
          expect.objectContaining({
            parse_mode: 'Markdown',
            reply_markup: expect.objectContaining({
              inline_keyboard: expect.any(Array),
            }),
          })
        );
        expect(ctx.session).toEqual(
          expect.objectContaining({
            communitiesWaitingForSearch: true,
          })
        );
      });

      it('should handle unknown callback', async () => {
        const ctx = createMockContext({
          callbackQuery: { data: 'unknown_action' } as any,
        });

        await handleCommunitiesCallback(ctx);

        expect(ctx.answerCbQuery).toHaveBeenCalledWith('Unknown action');
      });
    });

    describe('Community creation flow', () => {
      it('should handle slug step', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: 'test-slug' } as any,
        });
        
        // Set up session for slug step
        ctx.session.communityCreation = {
          step: 1,
          data: {},
        };

        const handled = await handleCommunityCreationFlow(ctx);

        expect(handled).toBe(true);
        expect(ctx.reply).toHaveBeenCalled();
      });

      it('should handle name step', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: 'Test Community Name' } as any,
        });
        
        // Set up session for name step
        ctx.session.communityCreation = {
          step: 2,
          data: { slug: 'test-slug' },
        };

        const handled = await handleCommunityCreationFlow(ctx);

        expect(handled).toBe(true);
        expect(ctx.reply).toHaveBeenCalled();
      });

      it('should not handle when not in creation flow', async () => {
        const ctx = createMockContext({
          message: { ...createMockContext().message, text: 'random message' } as any,
        });

        const handled = await handleCommunityCreationFlow(ctx);

        expect(handled).toBe(false);
      });
    });

    describe('Communities search', () => {
      it('should handle search input', async () => {
        const ctx = createMockContext();
        
        // Set up session for search
        ctx.session.communitiesWaitingForSearch = true;

        await handleCommunitiesSearch(ctx, 'crypto');

        expect(ctx.reply).toHaveBeenCalledWith('🔍 Searching...', { parse_mode: 'Markdown' });
        expect(ctx.session).toEqual(
          expect.objectContaining({
            communitiesSearch: 'crypto',
            communitiesPage: 0,
            communitiesWaitingForSearch: false,
          })
        );
      });

      it('should handle search cancellation', async () => {
        const ctx = createMockContext();
        
        // Set up session for search
        ctx.session.communitiesWaitingForSearch = true;

        await handleCommunitiesSearch(ctx, 'cancel');

        expect(ctx.session).toEqual(
          expect.objectContaining({
            communitiesWaitingForSearch: false,
          })
        );
      });

      it('should not handle when not waiting for search', async () => {
        const ctx = createMockContext();

        await handleCommunitiesSearch(ctx, 'crypto');

        // Should not have been handled (no reply called)
        expect(ctx.reply).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully in join command', async () => {
      const ctx = createMockContext();
      
             // Mock a service error by using non-existent user ID
       const errorCtx = createMockContext({
         session: {
           ...ctx.session,
           user: { 
             ...ctx.session?.user!,
             id: 'non-existent-user',
           },
         },
       });

      await joinCommand(errorCtx, 'some-slug');

      expect(errorCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.objectContaining({
          parse_mode: 'Markdown',
        })
      );
    });

    it('should handle callback errors gracefully', async () => {
      const ctx = createMockContext({
        callbackQuery: { data: 'communities_next' } as any,
        editMessageText: jest.fn().mockRejectedValue(new Error('Test error')),
      });

      await handleCommunitiesCallback(ctx);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith('❌ Action failed');
    });
  });
});