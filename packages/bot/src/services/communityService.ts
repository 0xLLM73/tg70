/**
 * Community Service - CRUD operations for communities
 */

import { supabase } from './database.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const CreateCommunitySchema = z.object({
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9_-]+$/, 'Slug can only contain lowercase letters, numbers, underscores, and hyphens'),
  name: z.string()
    .min(3, 'Community name must be at least 3 characters')
    .max(100, 'Community name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  is_private: z.boolean().default(false),
});

const UpdateCommunitySchema = CreateCommunitySchema.partial().omit({ slug: true });

const JoinCommunitySchema = z.object({
  community_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export interface Community {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_private: boolean;
  creator_id?: string;
  member_count: number;
  post_count: number;
  avatar_url?: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'banned';
  joined_at: string;
  updated_at: string;
}

export interface CreateCommunityData {
  slug: string;
  name: string;
  description?: string;
  is_private?: boolean;
}

export interface CommunityListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: 'newest' | 'popular' | 'alphabetical';
}

export class CommunityService {
  /**
   * Create a new community
   */
  static async create(userId: string, data: CreateCommunityData): Promise<Community> {
    try {
      // Validate input
      const validated = CreateCommunitySchema.parse(data);
      
      // Sanitize description if provided (simple text only for now)
      const sanitizedDescription = validated.description 
        ? validated.description.replace(/<[^>]*>/g, '').trim()
        : undefined;

      // Check if slug is already taken
      const { data: existing } = await supabase
        .from('communities')
        .select('id')
        .eq('slug', validated.slug)
        .single();

      if (existing) {
        throw new Error('Community slug is already taken');
      }

      // Create community
      const { data: community, error } = await supabase
        .from('communities')
        .insert({
          ...validated,
          description: sanitizedDescription,
          creator_id: userId,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create community:', error);
        throw new Error('Failed to create community');
      }

      // Add creator as admin member
      await this.addMember(community.id, userId, 'admin', 'active');

      // Log community creation
      await supabase.from('auth_events').insert({
        user_id: userId,
        event: 'join_community',
        metadata: { 
          community_id: community.id, 
          community_slug: community.slug,
          action: 'create'
        },
      });

      logger.info(`Community created: ${community.slug} by user ${userId}`);
      return community;
    } catch (error) {
      logger.error('Community creation failed:', error);
      throw error;
    }
  }

  /**
   * Get community by slug
   */
  static async getBySlug(slug: string, userId?: string): Promise<Community | null> {
    try {
      const { data: community, error } = await supabase
        .from('communities')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to get community by slug:', error);
        throw new Error('Failed to get community');
      }

      if (!community) {
        return null;
      }

      // Check if user has access to private community
      if (community.is_private) {
        if (!userId) {
          return null; // Hide private community from anonymous users
        }
        const isMember = await this.isMember(community.id, userId);
        if (!isMember) {
          return null; // Hide private community from non-members
        }
      }

      return community;
    } catch (error) {
      logger.error('Failed to get community by slug:', error);
      throw error;
    }
  }

  /**
   * Get community by ID
   */
  static async getById(id: string, userId?: string): Promise<Community | null> {
    try {
      const community = await this.getByIdInternal(id);
      if (!community) {
        return null;
      }

      // Check if user has access to private community
      if (community.is_private) {
        if (!userId) {
          return null; // Hide private community from anonymous users
        }
        const isMember = await this.isMember(community.id, userId);
        if (!isMember) {
          return null;
        }
      }

      return community;
    } catch (error) {
      logger.error('Failed to get community by id:', error);
      throw error;
    }
  }

  /**
   * Internal method to get community by ID without privacy checks
   */
  private static async getByIdInternal(id: string): Promise<Community | null> {
    try {
      const { data: community, error } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to get community by id:', error);
        throw new Error('Failed to get community');
      }

      return community;
    } catch (error) {
      logger.error('Failed to get community by id:', error);
      throw error;
    }
  }

  /**
   * List communities with pagination and filtering
   */
  static async list(options: CommunityListOptions = {}, userId?: string): Promise<{ communities: Community[]; hasMore: boolean }> {
    try {
      const { limit = 10, offset = 0, search, sort = 'newest' } = options;

      let query = supabase
        .from('communities')
        .select('*', { count: 'estimated' });

      // For non-authenticated users, only show public communities
      if (!userId) {
        query = query.eq('is_private', false);
      } else {
        // For authenticated users, show public communities and private ones they're members of
        query = query.or(`is_private.eq.false,id.in.(${await this.getUserCommunityIds(userId)})`);
      }

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply sorting
      switch (sort) {
        case 'popular':
          query = query.order('member_count', { ascending: false });
          break;
        case 'alphabetical':
          query = query.order('name', { ascending: true });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      query = query.range(offset, offset + limit);

      const { data: communities, error, count } = await query;

      if (error) {
        logger.error('Failed to list communities:', error);
        throw new Error('Failed to list communities');
      }

      const hasMore = count ? (offset + limit) < count : false;

      return {
        communities: communities || [],
        hasMore,
      };
    } catch (error) {
      logger.error('Failed to list communities:', error);
      throw error;
    }
  }

  /**
   * Join a community
   */
  static async join(communityId: string, userId: string): Promise<{ status: 'joined' | 'pending' }> {
    try {
      // Validate input
      JoinCommunitySchema.parse({ community_id: communityId, user_id: userId });

      // Check if community exists (bypass privacy for join operations)
      const community = await this.getByIdInternal(communityId);
      if (!community) {
        throw new Error('Community not found');
      }

      // Check if already a member
      const existingMember = await this.getMember(communityId, userId);
      if (existingMember) {
        if (existingMember.status === 'active') {
          throw new Error('Already a member of this community');
        }
        if (existingMember.status === 'pending') {
          throw new Error('Join request is already pending');
        }
        if (existingMember.status === 'banned') {
          throw new Error('You have been banned from this community');
        }
      }

      // Determine status based on community privacy
      const status = community.is_private ? 'pending' : 'active';

      // Add member
      await this.addMember(communityId, userId, 'member', status);

      // Log join event
      await supabase.from('auth_events').insert({
        user_id: userId,
        event: 'join_community',
        metadata: { 
          community_id: communityId, 
          community_slug: community.slug,
          status
        },
      });

      // TODO: Notify community admins for private communities
      if (community.is_private && status === 'pending') {
        // This would be implemented in the notification service
        logger.info(`Pending join request for private community: ${community.slug} by user ${userId}`);
      }

      logger.info(`User ${userId} ${status === 'active' ? 'joined' : 'requested to join'} community: ${community.slug}`);
      
      return { status: status === 'active' ? 'joined' : 'pending' };
    } catch (error) {
      logger.error('Failed to join community:', error);
      throw error;
    }
  }

  /**
   * Leave a community
   */
  static async leave(communityId: string, userId: string): Promise<void> {
    try {
      // Check if user is a member
      const member = await this.getMember(communityId, userId);
      if (!member) {
        throw new Error('Not a member of this community');
      }

      // Don't allow community creator to leave (they need to transfer ownership first)
      const community = await this.getByIdInternal(communityId);
      if (community?.creator_id === userId) {
        throw new Error('Community creator cannot leave. Transfer ownership first.');
      }

      // Remove membership
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to leave community:', error);
        throw new Error('Failed to leave community');
      }

      // Log leave event
      await supabase.from('auth_events').insert({
        user_id: userId,
        event: 'leave_community',
        metadata: { 
          community_id: communityId, 
          community_slug: community?.slug
        },
      });

      logger.info(`User ${userId} left community: ${community?.slug}`);
    } catch (error) {
      logger.error('Failed to leave community:', error);
      throw error;
    }
  }

  /**
   * Check if user is a member of a community
   */
  static async isMember(communityId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select('status')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to check membership:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('Failed to check membership:', error);
      return false;
    }
  }

  /**
   * Get user's role in a community
   */
  static async getUserRole(communityId: string, userId: string): Promise<'admin' | 'moderator' | 'member' | null> {
    try {
      const member = await this.getMember(communityId, userId);
      return member?.status === 'active' ? member.role : null;
    } catch (error) {
      logger.error('Failed to get user role:', error);
      return null;
    }
  }

  /**
   * Get communities user is a member of
   */
  static async getUserCommunities(userId: string): Promise<Community[]> {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          communities:community_id (
            id, slug, name, description, is_private, 
            member_count, post_count, avatar_url, 
            created_at, updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) {
        logger.error('Failed to get user communities:', error);
        throw new Error('Failed to get user communities');
      }

      return (data || []).map(item => (item as any).communities).filter(Boolean) as Community[];
    } catch (error) {
      logger.error('Failed to get user communities:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private static async addMember(
    communityId: string, 
    userId: string, 
    role: 'admin' | 'moderator' | 'member' = 'member',
    status: 'active' | 'pending' | 'banned' = 'active'
  ): Promise<void> {
    const { error } = await supabase
      .from('community_members')
      .insert({
        community_id: communityId,
        user_id: userId,
        role,
        status,
      });

    if (error) {
      logger.error('Failed to add community member:', error);
      throw new Error('Failed to add member');
    }
  }

  private static async getMember(communityId: string, userId: string): Promise<CommunityMember | null> {
    const { data, error } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to get community member:', error);
      return null;
    }

    return data;
  }

  private static async getUserCommunityIds(userId: string): Promise<string> {
    const { data } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    const ids = (data || []).map(item => item.community_id);
    return ids.length > 0 ? ids.join(',') : '';
  }
}