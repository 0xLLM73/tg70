/**
 * Edge Cases and Error Scenario Tests
 * Comprehensive testing of error handling, validation, and edge cases
 */

import { CommunityService } from '../services/communityService.js';
import { communitiesCommand, handleCommunitiesCallback } from '../commands/communities.js';
import { createCommunityCommand, handleCommunityCreationFlow } from '../commands/createCommunity.js';
import { joinCommand, parseJoinCommand } from '../commands/join.js';
import { createTestUser, createTestCommunity, cleanupTestData } from './setup.js';
import { BotContext } from '../types/index.js';

// Mock context factory for edge case tests
function createEdgeCaseContext(overrides: Partial<BotContext> = {}): BotContext {
  const mockContext: BotContext = {
    reply: jest.fn().mockResolvedValue({ message_id: 123 }),
    editMessageText: jest.fn().mockResolvedValue(true),
    deleteMessage: jest.fn().mockResolvedValue(true),
    answerCbQuery: jest.fn().mockResolvedValue(true),
    session: {
      userId: 123,
      lastActivity: new Date(),
      user: {
        id: 'edge-case-user-id',
        telegram_id: 123,
        email: 'edgecase@example.com',
        username: 'edgecaseuser',
        first_name: 'EdgeCase',
        last_name: 'User',
        is_bot: false,
        language_code: 'en',
        is_premium: false,
        role: 'user' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    from: {
      id: 123,
      is_bot: false,
      first_name: 'EdgeCase',
      last_name: 'User',
      username: 'edgecaseuser',
    },
    message: {
      message_id: 456,
      date: Date.now() / 1000,
      chat: { id: 789, type: 'private' },
      from: {
        id: 123,
        is_bot: false,
        first_name: 'EdgeCase',
        last_name: 'User',
        username: 'edgecaseuser',
      },
      text: '/test',
    },
    callbackQuery: undefined,
    ...overrides,
  } as any;

  return mockContext;
}

describe('Edge Cases and Error Scenarios', () => {
  beforeEach(async () => {
    await cleanupTestData();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Input Validation Edge Cases', () => {
    describe('Community Slug Validation', () => {
      it('should reject extremely long slugs', async () => {
        const user = await createTestUser();
        const longSlug = 'a'.repeat(100);

        await expect(
          CommunityService.create(user.id, {
            slug: longSlug,
            name: 'Test Community',
          })
        ).rejects.toThrow();
      });

      it('should reject extremely short slugs', async () => {
        const user = await createTestUser();

        await expect(
          CommunityService.create(user.id, {
            slug: 'ab',
            name: 'Test Community',
          })
        ).rejects.toThrow();
      });

      it('should reject slugs with invalid characters', async () => {
        const user = await createTestUser();
        const invalidSlugs = [
          'test@community',
          'test community',
          'test.community',
          'test#community',
          'test$community',
          'Test-Community', // uppercase
          'test_community!',
          'тест-community', // non-latin
        ];

        for (const slug of invalidSlugs) {
          await expect(
            CommunityService.create(user.id, {
              slug,
              name: 'Test Community',
            })
          ).rejects.toThrow();
        }
      });

      it('should accept valid edge case slugs', async () => {
        const user = await createTestUser();
        const validSlugs = [
          'abc',
          'test-community-with-long-name-but-under-limit',
          'test_community_with_underscores',
          'testcommunity123',
          '123-test-community',
          'a-b-c-d-e-f-g',
        ];

        for (const slug of validSlugs) {
          const community = await CommunityService.create(user.id, {
            slug,
            name: `Test Community ${slug}`,
          });
          expect(community.slug).toBe(slug);
        }
      });
    });

    describe('Community Name Validation', () => {
      it('should reject extremely long names', async () => {
        const user = await createTestUser();
        const longName = 'A'.repeat(200);

        await expect(
          CommunityService.create(user.id, {
            slug: 'test-community',
            name: longName,
          })
        ).rejects.toThrow();
      });

      it('should reject extremely short names', async () => {
        const user = await createTestUser();

        await expect(
          CommunityService.create(user.id, {
            slug: 'test-community',
            name: 'ab',
          })
        ).rejects.toThrow();
      });

      it('should handle unicode and special characters in names', async () => {
        const user = await createTestUser();
        const unicodeNames = [
          '🚀 Crypto Community 🌟',
          'Тест Сообщество',
          'Comunidad de Cripto',
          'Test & Development',
          'AI/ML Community',
          '"The Best" Community',
        ];

        for (const name of unicodeNames) {
          const community = await CommunityService.create(user.id, {
            slug: `test-${Date.now()}`,
            name,
          });
          expect(community.name).toBe(name);
        }
      });
    });

    describe('Description Validation', () => {
      it('should reject extremely long descriptions', async () => {
        const user = await createTestUser();
        const longDesc = 'A'.repeat(1000);

        await expect(
          CommunityService.create(user.id, {
            slug: 'test-community',
            name: 'Test Community',
            description: longDesc,
          })
        ).rejects.toThrow();
      });

      it('should handle empty descriptions', async () => {
        const user = await createTestUser();

        const community = await CommunityService.create(user.id, {
          slug: 'test-empty-desc',
          name: 'Test Community',
          description: '',
        });

        expect(community.description).toBe('');
      });

      it('should sanitize HTML in descriptions', async () => {
        const user = await createTestUser();
        const htmlDesc = '<script>alert("hack")</script>Safe description';

        const community = await CommunityService.create(user.id, {
          slug: 'test-html-desc',
          name: 'Test Community',
          description: htmlDesc,
        });

        // Should strip HTML tags
        expect(community.description).toBe('Safe description');
      });
    });
  });

  describe('Authentication and Authorization Edge Cases', () => {
    it('should handle missing user session', async () => {
      const ctx = createEdgeCaseContext({
        session: {} as any, // Empty session
      });

      await communitiesCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('🔐 Please authenticate first using /start');
    });

    it('should handle corrupted user data', async () => {
      const ctx = createEdgeCaseContext({
        session: {
          userId: 123,
          lastActivity: new Date(),
          user: null as any, // Null user
        },
      });

      await communitiesCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('🔐 Please authenticate first using /start');
    });

    it('should handle invalid user IDs', async () => {
      const ctx = createEdgeCaseContext({
        session: {
          userId: 123,
          lastActivity: new Date(),
          user: {
            id: 'invalid-uuid-format',
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
        },
      });

      await joinCommand(ctx, 'test-community');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.any(Object)
      );
    });
  });

  describe('Database Edge Cases', () => {
    it('should handle database constraints properly', async () => {
      const user = await createTestUser();

      // Create community
      await CommunityService.create(user.id, {
        slug: 'constraint-test',
        name: 'Constraint Test',
      });

      // Try to create duplicate
      await expect(
        CommunityService.create(user.id, {
          slug: 'constraint-test', // Same slug
          name: 'Different Name',
        })
      ).rejects.toThrow('Community slug is already taken');
    });

    it('should handle orphaned data gracefully', async () => {
      // Test getting community with non-existent ID
      const community = await CommunityService.getBySlug('definitely-does-not-exist');
      expect(community).toBeNull();
    });

    it('should handle concurrent operations', async () => {
      const user = await createTestUser();
      const community = await createTestCommunity(user.id, {
        slug: 'concurrent-ops-test',
        name: 'Concurrent Operations Test',
      });

      // Multiple concurrent join attempts by different users
      const users = await Promise.all([
        createTestUser(),
        createTestUser(),
        createTestUser(),
      ]);

      const joinPromises = users.map(u => CommunityService.join(community.id, u.id));
      const results = await Promise.all(joinPromises);

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe('joined');
      });

      // Verify all are members
      for (const user of users) {
        const isMember = await CommunityService.isMember(community.id, user.id);
        expect(isMember).toBe(true);
      }
    });
  });

  describe('Session Management Edge Cases', () => {
    it('should handle malformed session data', async () => {
      const ctx = createEdgeCaseContext();
      
      // Corrupt community creation session
      ctx.session.communityCreation = {
        step: 'invalid' as any,
        data: null as any,
      };

      (ctx.message as any).text = 'some-input';
      const handled = await handleCommunityCreationFlow(ctx);
      expect(handled).toBe(false);
    });

    it('should handle extremely large session data', async () => {
      const ctx = createEdgeCaseContext();
      
      // Very large session data
      ctx.session.communityCreation = {
        step: 3,
        data: {
          slug: 'test-slug',
          name: 'Test Name',
          description: 'A'.repeat(500), // Max allowed
        },
      };

      (ctx.message as any).text = 'public';
      const handled = await handleCommunityCreationFlow(ctx);
      expect(handled).toBe(true);
    });

    it('should handle session expiry during flow', async () => {
      const ctx = createEdgeCaseContext();
      
      // Start community creation
      await createCommunityCommand(ctx);
      
      // Simulate session clear
      delete ctx.session.communityCreation;
      
      // Try to continue flow
      (ctx.message as any).text = 'some-slug';
      const handled = await handleCommunityCreationFlow(ctx);
      expect(handled).toBe(false);
    });
  });

  describe('Command Parsing Edge Cases', () => {
    describe('Join Command Parsing', () => {
      it('should handle malformed join commands', async () => {
        expect(parseJoinCommand('')).toBeUndefined();
        expect(parseJoinCommand('/join')).toBeUndefined();
        expect(parseJoinCommand('/join   ')).toBeUndefined();
        expect(parseJoinCommand('join test-community')).toBe('test-community'); // No slash
      });

      it('should handle extra spaces and formatting', async () => {
        expect(parseJoinCommand('/join    test-community   ')).toBe('test-community');
        expect(parseJoinCommand('/join\ttest-community')).toBe('test-community');
        expect(parseJoinCommand('/join\ntest-community')).toBe('test-community');
      });

      it('should handle case sensitivity', async () => {
        expect(parseJoinCommand('/join TEST-COMMUNITY')).toBe('test-community');
        expect(parseJoinCommand('/JOIN test-community')).toBe('test-community');
      });
    });
  });

  describe('UI and UX Edge Cases', () => {
    it('should handle extremely long community lists', async () => {
      const creator = await createTestUser();
      
             // Create communities with very long names
       const communities: any[] = [];
       for (let i = 0; i < 3; i++) {
         const community = await CommunityService.create(creator.id, {
           slug: `long-name-${i}`,
           name: 'A'.repeat(95) + ` ${i}`, // Near max length
           description: 'B'.repeat(400), // Near max length
         });
         communities.push(community);
       }

      const ctx = createEdgeCaseContext();
      ctx.session.user!.id = creator.id;

      await communitiesCommand(ctx);
      
      // Should handle long content gracefully
      expect(ctx.reply).toHaveBeenCalled();
      const replyMessage = (ctx.reply as jest.Mock).mock.calls[0][0];
      expect(typeof replyMessage).toBe('string');
      expect(replyMessage.length).toBeGreaterThan(0);
    });

    it('should handle callback query failures', async () => {
      const ctx = createEdgeCaseContext({
        answerCbQuery: jest.fn().mockRejectedValue(new Error('Callback failed')),
        callbackQuery: { data: 'communities_next' } as any,
      });

      // Should not throw despite callback failure
      await expect(handleCommunitiesCallback(ctx)).resolves.not.toThrow();
    });

    it('should handle message send failures', async () => {
      const ctx = createEdgeCaseContext({
        reply: jest.fn().mockRejectedValue(new Error('Send failed')),
      });

      // Should handle gracefully
      await expect(communitiesCommand(ctx)).resolves.not.toThrow();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid sequential operations', async () => {
      const user = await createTestUser();
      const ctx = createEdgeCaseContext();
      ctx.session.user!.id = user.id;

             // Rapid sequential commands
       const promises: Promise<void>[] = [];
       for (let i = 0; i < 10; i++) {
         promises.push(communitiesCommand(ctx));
       }

      await Promise.all(promises);
      
      // All should complete successfully
      expect(ctx.reply).toHaveBeenCalledTimes(10);
    });

    it('should handle large pagination requests', async () => {
      const creator = await createTestUser();
      
      // Create many communities
      for (let i = 0; i < 50; i++) {
        await CommunityService.create(creator.id, {
          slug: `perf-test-${i}`,
          name: `Performance Test ${i}`,
        });
      }

      // Test large pagination
      const { communities } = await CommunityService.list({
        limit: 50,
        offset: 0,
      });

      expect(communities.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Data Consistency Edge Cases', () => {
    it('should maintain referential integrity', async () => {
      const creator = await createTestUser();
      const community = await CommunityService.create(creator.id, {
        slug: 'integrity-test',
        name: 'Integrity Test',
      });

      // Verify creator is automatically added as admin
      const role = await CommunityService.getUserRole(community.id, creator.id);
      expect(role).toBe('admin');

      const isMember = await CommunityService.isMember(community.id, creator.id);
      expect(isMember).toBe(true);
    });

    it('should handle leave operations correctly', async () => {
      const creator = await createTestUser();
      const member = await createTestUser();
      
      const community = await CommunityService.create(creator.id, {
        slug: 'leave-test',
        name: 'Leave Test',
      });

      // Member joins
      await CommunityService.join(community.id, member.id);
      expect(await CommunityService.isMember(community.id, member.id)).toBe(true);

      // Member leaves
      await CommunityService.leave(community.id, member.id);
      expect(await CommunityService.isMember(community.id, member.id)).toBe(false);
      expect(await CommunityService.getUserRole(community.id, member.id)).toBeNull();
    });

    it('should prevent creator from leaving their own community', async () => {
      const creator = await createTestUser();
      const community = await CommunityService.create(creator.id, {
        slug: 'creator-leave-test',
        name: 'Creator Leave Test',
      });

      await expect(
        CommunityService.leave(community.id, creator.id)
      ).rejects.toThrow('Community creator cannot leave');
    });
  });

  describe('Unicode and Internationalization Edge Cases', () => {
    it('should handle various character encodings', async () => {
      const user = await createTestUser();
      
      const unicodeData = {
        slug: 'unicode-test-community',
        name: '🚀 Test コミュニティ 🌟',
        description: 'Descripción con acentos, 中文字符, и русский текст',
      };

      const community = await CommunityService.create(user.id, unicodeData);
      expect(community.name).toBe(unicodeData.name);
      expect(community.description).toBe(unicodeData.description);
    });

    it('should handle emoji-heavy content', async () => {
      const user = await createTestUser();
      
      const emojiData = {
        slug: 'emoji-test',
        name: '🎮🎯🎲🎨🎭🎪🎨🎭🎪',
        description: '😀😃😄😁😆😅😂🤣😭😗😙😚😘',
      };

      const community = await CommunityService.create(user.id, emojiData);
      expect(community.name).toBe(emojiData.name);
    });
  });
});