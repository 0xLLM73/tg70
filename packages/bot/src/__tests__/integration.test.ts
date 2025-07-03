/**
 * Integration Tests
 * End-to-end workflow testing for community features
 */

import { CommunityService } from '../services/communityService.js';
import { communitiesCommand } from '../commands/communities.js';
import { createCommunityCommand, handleCommunityCreationFlow } from '../commands/createCommunity.js';
import { joinCommand } from '../commands/join.js';
import { createTestUser, cleanupTestData } from './setup.js';
import { BotContext } from '../types/index.js';

// Mock context factory for integration tests
function createIntegrationContext(overrides: Partial<BotContext> = {}): BotContext {
  const mockContext: BotContext = {
    reply: jest.fn().mockResolvedValue({ message_id: 123 }),
    editMessageText: jest.fn().mockResolvedValue(true),
    deleteMessage: jest.fn().mockResolvedValue(true),
    answerCbQuery: jest.fn().mockResolvedValue(true),
    session: {
      userId: 123,
      lastActivity: new Date(),
      user: {
        id: 'integration-user-id',
        telegram_id: 123,
        email: 'integration@example.com',
        username: 'integrationuser',
        first_name: 'Integration',
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
      first_name: 'Integration',
      last_name: 'User',
      username: 'integrationuser',
    },
    message: {
      message_id: 456,
      date: Date.now() / 1000,
      chat: { id: 789, type: 'private' },
      from: {
        id: 123,
        is_bot: false,
        first_name: 'Integration',
        last_name: 'User',
        username: 'integrationuser',
      },
      text: '/test',
    },
    callbackQuery: undefined,
    ...overrides,
  } as any;

  return mockContext;
}

describe('Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Complete Community Creation Workflow', () => {
    it('should complete full community creation from start to finish', async () => {
      const ctx = createIntegrationContext();
      const testUser = await createTestUser();
      
      // Update context with real user ID
      ctx.session.user!.id = testUser.id;

      // Step 1: Start community creation
      await createCommunityCommand(ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🏗️ **Create a New Community**'),
        expect.any(Object)
      );
      expect(ctx.session.communityCreation).toEqual({
        step: 1,
        data: {},
      });

             // Step 2: Enter slug
       (ctx.message as any).text = 'test-integration-community';
      const slugHandled = await handleCommunityCreationFlow(ctx);
      expect(slugHandled).toBe(true);
      expect(ctx.session.communityCreation?.step).toBe(2);
      expect(ctx.session.communityCreation?.data.slug).toBe('test-integration-community');

             // Step 3: Enter name
       (ctx.message as any).text = 'Test Integration Community';
       const nameHandled = await handleCommunityCreationFlow(ctx);
       expect(nameHandled).toBe(true);
       expect(ctx.session.communityCreation?.step).toBe(3);
       expect(ctx.session.communityCreation?.data.name).toBe('Test Integration Community');

       // Step 4: Enter description
       (ctx.message as any).text = 'A community for testing integration workflows';
       const descHandled = await handleCommunityCreationFlow(ctx);
       expect(descHandled).toBe(true);
       expect(ctx.session.communityCreation?.step).toBe(4);
       expect(ctx.session.communityCreation?.data.description).toBe('A community for testing integration workflows');

       // Step 5: Select privacy (public)
       (ctx.message as any).text = 'public';
       const privacyHandled = await handleCommunityCreationFlow(ctx);
       expect(privacyHandled).toBe(true);
       expect(ctx.session.communityCreation?.step).toBe(5);
       expect(ctx.session.communityCreation?.data.is_private).toBe(false);

       // Step 6: Confirm creation
       (ctx.message as any).text = 'yes';
      const confirmHandled = await handleCommunityCreationFlow(ctx);
      expect(confirmHandled).toBe(true);

      // Verify community was created in database
      const createdCommunity = await CommunityService.getBySlug('test-integration-community', testUser.id);
      expect(createdCommunity).toBeDefined();
      expect(createdCommunity?.name).toBe('Test Integration Community');
      expect(createdCommunity?.is_private).toBe(false);
      expect(createdCommunity?.creator_id).toBe(testUser.id);

      // Verify creator is admin member
      const isAdmin = await CommunityService.getUserRole(createdCommunity!.id, testUser.id);
      expect(isAdmin).toBe('admin');

      // Verify session was cleaned up
      expect(ctx.session.communityCreation).toBeUndefined();
    });

    it('should handle private community creation', async () => {
      const ctx = createIntegrationContext();
      const testUser = await createTestUser();
      ctx.session.user!.id = testUser.id;

      // Start creation and go through steps quickly
      await createCommunityCommand(ctx);
      
      // Set up complete flow data
      ctx.session.communityCreation = {
        step: 4,
        data: {
          slug: 'private-integration-test',
          name: 'Private Integration Test',
          description: 'A private community for testing',
        },
      };

             // Select privacy (private)
       (ctx.message as any).text = 'private';
       const privacyHandled = await handleCommunityCreationFlow(ctx);
       expect(privacyHandled).toBe(true);
       expect(ctx.session.communityCreation?.data.is_private).toBe(true);

       // Confirm creation
       (ctx.message as any).text = 'yes';
      await handleCommunityCreationFlow(ctx);

      // Verify private community was created
      const createdCommunity = await CommunityService.getBySlug('private-integration-test', testUser.id);
      expect(createdCommunity).toBeDefined();
      expect(createdCommunity?.is_private).toBe(true);
    });

    it('should handle creation cancellation', async () => {
      const ctx = createIntegrationContext();
      const testUser = await createTestUser();
      ctx.session.user!.id = testUser.id;

      // Start creation
      await createCommunityCommand(ctx);
      
             // Cancel during slug step
       (ctx.message as any).text = 'cancel';
      const cancelHandled = await handleCommunityCreationFlow(ctx);
      expect(cancelHandled).toBe(true);

      // Verify session was cleaned up
      expect(ctx.session.communityCreation).toBeUndefined();

      // Verify no community was created
      const community = await CommunityService.getBySlug('any-slug');
      expect(community).toBeNull();
    });
  });

  describe('Discovery → Join → Membership Workflow', () => {
    it('should complete full discovery and join workflow for public community', async () => {
      // Setup: Create a community first
      const creator = await createTestUser();
      const community = await CommunityService.create(creator.id, {
        slug: 'discoverable-community',
        name: 'Discoverable Community',
        description: 'A community that can be discovered and joined',
        is_private: false,
      });

      // Step 1: User discovers communities
      const discoveryCtx = createIntegrationContext();
      const joiner = await createTestUser();
      discoveryCtx.session.user!.id = joiner.id;

      await communitiesCommand(discoveryCtx);

      expect(discoveryCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Discoverable Community'),
        expect.any(Object)
      );

      // Step 2: User joins the community
      await joinCommand(discoveryCtx, 'discoverable-community');

      // Verify join was successful
      expect(discoveryCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🎉 **Welcome to Discoverable Community!**'),
        expect.any(Object)
      );

      // Step 3: Verify membership in database
      const isMember = await CommunityService.isMember(community.id, joiner.id);
      expect(isMember).toBe(true);

      const userRole = await CommunityService.getUserRole(community.id, joiner.id);
      expect(userRole).toBe('member');

      // Step 4: Verify discovery now shows user as member
      await communitiesCommand(discoveryCtx);
      // Should still show the community (user can see it as member)
      expect(discoveryCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Discoverable Community'),
        expect.any(Object)
      );
    });

    it('should handle private community discovery and join request', async () => {
      // Setup: Create a private community
      const creator = await createTestUser();
      const community = await CommunityService.create(creator.id, {
        slug: 'private-exclusive',
        name: 'Private Exclusive Community',
        description: 'An exclusive private community',
        is_private: true,
      });

      // Step 1: Non-member tries to discover - should not see private community
      const outsiderCtx = createIntegrationContext();
      const outsider = await createTestUser();
      outsiderCtx.session.user!.id = outsider.id;

      await communitiesCommand(outsiderCtx);

      // Should not contain the private community in discovery
      const replyCall = (outsiderCtx.reply as jest.Mock).mock.calls.find(call => 
        call[0].includes('Community Discovery')
      );
      expect(replyCall[0]).not.toContain('Private Exclusive Community');

      // Step 2: Outsider tries to join directly by slug
      await joinCommand(outsiderCtx, 'private-exclusive');

      expect(outsiderCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🤷‍♂️ **Community Not Found**'),
        expect.any(Object)
      );

      // Step 3: Creator can see and manage their private community
      const creatorCtx = createIntegrationContext();
      creatorCtx.session.user!.id = creator.id;

      await communitiesCommand(creatorCtx);

      expect(creatorCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Private Exclusive Community'),
        expect.any(Object)
      );
    });
  });

  describe('Multi-User Community Interaction', () => {
    it('should handle multiple users joining the same community', async () => {
      // Setup: Create community and multiple users
      const creator = await createTestUser();
      const community = await CommunityService.create(creator.id, {
        slug: 'multi-user-test',
        name: 'Multi User Test Community',
        is_private: false,
      });

      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const user3 = await createTestUser();

      // Each user joins the community
      const ctx1 = createIntegrationContext();
      ctx1.session.user!.id = user1.id;
      await joinCommand(ctx1, 'multi-user-test');

      const ctx2 = createIntegrationContext();
      ctx2.session.user!.id = user2.id;
      await joinCommand(ctx2, 'multi-user-test');

      const ctx3 = createIntegrationContext();
      ctx3.session.user!.id = user3.id;
      await joinCommand(ctx3, 'multi-user-test');

      // Verify all are members
      expect(await CommunityService.isMember(community.id, user1.id)).toBe(true);
      expect(await CommunityService.isMember(community.id, user2.id)).toBe(true);
      expect(await CommunityService.isMember(community.id, user3.id)).toBe(true);

      // Verify member count increased (creator + 3 new members = 4)
      const updatedCommunity = await CommunityService.getBySlug('multi-user-test', creator.id);
      expect(updatedCommunity?.member_count).toBe(4);

      // Verify all users can discover the community
      await communitiesCommand(ctx1);
      expect(ctx1.reply).toHaveBeenCalledWith(
        expect.stringContaining('Multi User Test Community'),
        expect.any(Object)
      );
    });

    it('should handle user leaving community', async () => {
      // Setup: Create community and user
      const creator = await createTestUser();
      const community = await CommunityService.create(creator.id, {
        slug: 'leave-test-community',
        name: 'Leave Test Community',
        is_private: false,
      });

      const member = await createTestUser();
      await CommunityService.join(community.id, member.id);

      // Verify member is in community
      expect(await CommunityService.isMember(community.id, member.id)).toBe(true);

      // Member leaves community
      await CommunityService.leave(community.id, member.id);

      // Verify member is no longer in community
      expect(await CommunityService.isMember(community.id, member.id)).toBe(false);
      expect(await CommunityService.getUserRole(community.id, member.id)).toBeNull();

      // Verify member count decreased
      const updatedCommunity = await CommunityService.getBySlug('leave-test-community', creator.id);
      expect(updatedCommunity?.member_count).toBe(1); // Only creator left
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle network failures gracefully', async () => {
      const ctx = createIntegrationContext();
      
      // Mock network failure
      ctx.reply = jest.fn().mockRejectedValueOnce(new Error('Network error'));
      
      await expect(communitiesCommand(ctx)).resolves.not.toThrow();
    });

    it('should handle invalid session states', async () => {
      const ctx = createIntegrationContext();
      
      // Corrupt session data
      ctx.session.communityCreation = {
        step: 99 as any, // Invalid step
        data: {},
      };

      const handled = await handleCommunityCreationFlow(ctx);
      expect(handled).toBe(false); // Should not handle invalid state
    });

    it('should handle concurrent join requests', async () => {
      const creator = await createTestUser();
      const community = await CommunityService.create(creator.id, {
        slug: 'concurrent-test',
        name: 'Concurrent Test Community',
        is_private: false,
      });

      const user = await createTestUser();

      // Simulate concurrent join requests
      const join1 = CommunityService.join(community.id, user.id);
      const join2 = CommunityService.join(community.id, user.id);

      const results = await Promise.allSettled([join1, join2]);

      // One should succeed, one should fail with "already a member"
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const errorCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount + errorCount).toBe(2);
      expect(successCount).toBeGreaterThanOrEqual(1);

      // User should only be a member once
      expect(await CommunityService.isMember(community.id, user.id)).toBe(true);
    });

    it('should handle session interruption and resumption', async () => {
      const ctx = createIntegrationContext();
      const testUser = await createTestUser();
      ctx.session.user!.id = testUser.id;

      // Start community creation
      await createCommunityCommand(ctx);
      
             // Simulate session interruption (user sends different message)
       (ctx.message as any).text = '/help';
       let handled = await handleCommunityCreationFlow(ctx);
       expect(handled).toBe(false); // Should not handle unrelated message

       // Resume creation flow
       (ctx.message as any).text = 'resumed-community-slug';
      handled = await handleCommunityCreationFlow(ctx);
      expect(handled).toBe(true); // Should handle valid slug input

      expect(ctx.session.communityCreation?.data.slug).toBe('resumed-community-slug');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple rapid community creations', async () => {
      const testUser = await createTestUser();
      
      const createCommunity = async (index: number) => {
        return CommunityService.create(testUser.id, {
          slug: `rapid-community-${index}`,
          name: `Rapid Community ${index}`,
          is_private: false,
        });
      };

      // Create multiple communities rapidly
      const promises = Array.from({ length: 5 }, (_, i) => createCommunity(i));
      const communities = await Promise.all(promises);

      expect(communities).toHaveLength(5);
      communities.forEach((community, index) => {
        expect(community.slug).toBe(`rapid-community-${index}`);
        expect(community.creator_id).toBe(testUser.id);
      });
    });

    it('should handle large community discovery lists', async () => {
      const creator = await createTestUser();
      
      // Create many communities
      const createPromises = Array.from({ length: 15 }, (_, i) => 
        CommunityService.create(creator.id, {
          slug: `large-list-${i}`,
          name: `Large List Community ${i}`,
          is_private: false,
        })
      );
      
      await Promise.all(createPromises);

      // Test discovery with pagination
      const { communities, hasMore } = await CommunityService.list({ limit: 5, offset: 0 });
      
      expect(communities).toHaveLength(5);
      expect(hasMore).toBe(true);

      // Test second page
      const { communities: page2 } = await CommunityService.list({ limit: 5, offset: 5 });
      expect(page2).toHaveLength(5);
    });
  });
});