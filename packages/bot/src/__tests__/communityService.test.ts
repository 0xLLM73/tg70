/**
 * Community Service Tests
 */

import { CommunityService } from '../services/communityService.js';
import { createTestUser, createTestCommunity, cleanupTestData } from './setup.js';

describe('CommunityService', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('create', () => {
    it('should create a public community successfully', async () => {
      // Create test user
      const user = await createTestUser();

      // Create community
      const communityData = {
        slug: 'test-community',
        name: 'Test Community',
        description: 'A test community for testing',
        is_private: false,
      };

      const community = await CommunityService.create(user.id, communityData);

      expect(community).toBeDefined();
      expect(community.slug).toBe('test-community');
      expect(community.name).toBe('Test Community');
      expect(community.description).toBe('A test community for testing');
      expect(community.is_private).toBe(false);
      expect(community.creator_id).toBe(user.id);
      expect(community.member_count).toBe(1); // Creator is automatically added
    });

    it('should create a private community successfully', async () => {
      // Create test user
      const user = await createTestUser();

      // Create community
      const communityData = {
        slug: 'private-community',
        name: 'Private Community',
        is_private: true,
      };

      const community = await CommunityService.create(user.id, communityData);

      expect(community).toBeDefined();
      expect(community.slug).toBe('private-community');
      expect(community.name).toBe('Private Community');
      expect(community.is_private).toBe(true);
      expect(community.creator_id).toBe(user.id);
    });

    it('should reject duplicate slugs', async () => {
      // Create test user
      const user = await createTestUser();

      // Create first community
      const communityData = {
        slug: 'duplicate-slug',
        name: 'First Community',
      };

      await CommunityService.create(user.id, communityData);

      // Try to create second community with same slug
      const duplicateData = {
        slug: 'duplicate-slug',
        name: 'Second Community',
      };

      await expect(
        CommunityService.create(user.id, duplicateData)
      ).rejects.toThrow('Community slug is already taken');
    });

    it('should validate slug format', async () => {
      // Create test user
      const user = await createTestUser();

      // Test invalid slug with uppercase
      const invalidData = {
        slug: 'Invalid-Slug',
        name: 'Test Community',
      };

      await expect(
        CommunityService.create(user.id, invalidData)
      ).rejects.toThrow();
    });
  });

  describe('getBySlug', () => {
    it('should retrieve public community by slug', async () => {
      // Create test user and community
      const user = await createTestUser();
      const community = await createTestCommunity(user.id, {
        slug: 'public-test',
        name: 'Public Test Community',
        is_private: false,
      });

      // Retrieve community
      const retrieved = await CommunityService.getBySlug('public-test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(community.id);
      expect(retrieved?.slug).toBe('public-test');
      expect(retrieved?.name).toBe('Public Test Community');
    });

    it('should return null for non-existent community', async () => {
      const retrieved = await CommunityService.getBySlug('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should hide private community from non-members', async () => {
      // Create test user and private community
      const user = await createTestUser();
      await createTestCommunity(user.id, {
        slug: 'private-test',
        name: 'Private Test Community',
        is_private: true,
      });

      // Try to retrieve as non-member (no userId provided)
      const retrieved = await CommunityService.getBySlug('private-test');
      expect(retrieved).toBeNull();
    });

    it('should show private community to members', async () => {
      // Create test user and private community
      const user = await createTestUser();
      const community = await createTestCommunity(user.id, {
        slug: 'private-member-test',
        name: 'Private Member Test',
        is_private: true,
      });

      // Retrieve as member (creator)
      const retrieved = await CommunityService.getBySlug('private-member-test', user.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(community.id);
      expect(retrieved?.slug).toBe('private-member-test');
    });
  });

  describe('join', () => {
    it('should join public community immediately', async () => {
      // Create creator and joiner
      const creator = await createTestUser();
      const joiner = await createTestUser();

      // Create public community
      const community = await createTestCommunity(creator.id, {
        slug: 'public-join-test',
        is_private: false,
      });

      // Join community
      const result = await CommunityService.join(community.id, joiner.id);

      expect(result.status).toBe('joined');

      // Verify membership
      const isMember = await CommunityService.isMember(community.id, joiner.id);
      expect(isMember).toBe(true);
    });

    it('should create pending request for private community', async () => {
      // Create creator and joiner
      const creator = await createTestUser();
      const joiner = await createTestUser();

      // Create private community
      const community = await createTestCommunity(creator.id, {
        slug: 'private-join-test',
        is_private: true,
      });

      // Join community
      const result = await CommunityService.join(community.id, joiner.id);

      expect(result.status).toBe('pending');

      // Verify not yet a member (status is pending)
      const isMember = await CommunityService.isMember(community.id, joiner.id);
      expect(isMember).toBe(false); // isMember only returns true for 'active' status
    });

    it('should reject duplicate join requests', async () => {
      // Create creator and joiner
      const creator = await createTestUser();
      const joiner = await createTestUser();

      // Create public community
      const community = await createTestCommunity(creator.id, {
        slug: 'duplicate-join-test',
        is_private: false,
      });

      // Join community first time
      await CommunityService.join(community.id, joiner.id);

      // Try to join again
      await expect(
        CommunityService.join(community.id, joiner.id)
      ).rejects.toThrow('Already a member of this community');
    });
  });

  describe('isMember', () => {
    it('should return true for active members', async () => {
      // Create creator
      const creator = await createTestUser();

      // Create community (creator automatically becomes admin member)
      const community = await createTestCommunity(creator.id);

      // Check membership
      const isMember = await CommunityService.isMember(community.id, creator.id);
      expect(isMember).toBe(true);
    });

    it('should return false for non-members', async () => {
      // Create creator and non-member
      const creator = await createTestUser();
      const nonMember = await createTestUser();

      // Create community
      const community = await createTestCommunity(creator.id);

      // Check membership
      const isMember = await CommunityService.isMember(community.id, nonMember.id);
      expect(isMember).toBe(false);
    });
  });

  describe('getUserRole', () => {
    it('should return admin role for community creator', async () => {
      // Create creator
      const creator = await createTestUser();

      // Create community (creator automatically becomes admin)
      const community = await createTestCommunity(creator.id);

      // Check role
      const role = await CommunityService.getUserRole(community.id, creator.id);
      expect(role).toBe('admin');
    });

    it('should return null for non-members', async () => {
      // Create creator and non-member
      const creator = await createTestUser();
      const nonMember = await createTestUser();

      // Create community
      const community = await createTestCommunity(creator.id);

      // Check role
      const role = await CommunityService.getUserRole(community.id, nonMember.id);
      expect(role).toBeNull();
    });
  });
});