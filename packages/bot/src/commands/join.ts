/**
 * Join command - Join a community by slug
 */

import { BotContext } from '../types/index.js';
import { CommunityService } from '../services/communityService.js';
import { logger } from '../utils/logger.js';

export async function joinCommand(ctx: BotContext, slug?: string): Promise<void> {
  try {
    // Check if user is authenticated
    const sessionUser = ctx.session?.user;
    if (!sessionUser) {
      await ctx.reply('🔐 Please authenticate first using /start');
      return;
    }

    // Check if slug was provided
    if (!slug) {
      await ctx.reply(
        '📝 **Join a Community**\n\n' +
        'Please provide a community slug to join.\n\n' +
        '**Usage:**\n' +
        '`/join community-slug`\n\n' +
        '**Examples:**\n' +
        '• `/join web3-builders`\n' +
        '• `/join crypto-trading`\n' +
        '• `/join dev-chat`\n\n' +
        '💡 Use /communities to discover available communities.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      await ctx.reply(
        '❌ **Invalid Community Slug**\n\n' +
        'Community slugs can only contain:\n' +
        '• Lowercase letters (a-z)\n' +
        '• Numbers (0-9)\n' +
        '• Underscores (_)\n' +
        '• Hyphens (-)\n\n' +
        '**Example:** `web3-builders`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Check if community exists
    const community = await CommunityService.getBySlug(slug, sessionUser.id);
    if (!community) {
      await ctx.reply(
        '🤷‍♂️ **Community Not Found**\n\n' +
        `The community "${slug}" doesn't exist or you don't have access to it.\n\n` +
        '💡 Use /communities to discover available communities.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Check if already a member
    const isAlreadyMember = await CommunityService.isMember(community.id, sessionUser.id);
    if (isAlreadyMember) {
      const userRole = await CommunityService.getUserRole(community.id, sessionUser.id);
      
      await ctx.reply(
        `✅ **Already a Member**\n\n` +
        `You're already a member of **${community.name}**!\n\n` +
        `🎭 Your role: ${userRole === 'admin' ? '👑 Admin' : userRole === 'moderator' ? '🛡️ Moderator' : '👤 Member'}\n` +
        `📛 Community: \`${community.slug}\`\n` +
        `👥 ${community.member_count} members • 📄 ${community.post_count} posts`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '🏘️ Browse Communities', callback_data: 'communities' },
              { text: '➕ Create Community', callback_data: 'create_community' }
            ]]
          }
        }
      );
      return;
    }

    // Show loading message
    const loadingMessage = await ctx.reply('🔄 Joining community...');

    try {
      // Attempt to join
      const result = await CommunityService.join(community.id, sessionUser.id);

      // Delete loading message
      await ctx.deleteMessage(loadingMessage.message_id);

      if (result.status === 'joined') {
        // Successfully joined public community
        await ctx.reply(
          `🎉 **Welcome to ${community.name}!**\n\n` +
          `You've successfully joined the community.\n\n` +
          `📛 Community: \`${community.slug}\`\n` +
          `🌍 Type: ${community.is_private ? '🔒 Private' : '🌍 Public'}\n` +
          `👥 ${community.member_count + 1} members • 📄 ${community.post_count} posts\n\n` +
          `🎭 Your role: 👤 Member\n\n` +
          `${community.description ? `📝 ${community.description}\n\n` : ''}` +
          `💬 You can now participate in discussions and create posts!`,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '📝 Create Post', callback_data: `create_post_${community.slug}` },
                { text: '📄 View Posts', callback_data: `view_posts_${community.slug}` }
              ], [
                { text: '🏘️ Browse Communities', callback_data: 'communities' }
              ]]
            }
          }
        );
      } else {
        // Join request submitted for private community
        await ctx.reply(
          `📋 **Join Request Submitted**\n\n` +
          `Your request to join **${community.name}** has been submitted for review.\n\n` +
          `📛 Community: \`${community.slug}\`\n` +
          `🔒 Type: Private Community\n` +
          `👥 ${community.member_count} members • 📄 ${community.post_count} posts\n\n` +
          `⏳ **What happens next:**\n` +
          `• Community admins will review your request\n` +
          `• You'll be notified when a decision is made\n` +
          `• This may take a few hours or days\n\n` +
          `${community.description ? `📝 ${community.description}\n\n` : ''}` +
          `💡 While you wait, you can explore other communities!`,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🏘️ Browse Communities', callback_data: 'communities' },
                { text: '➕ Create Community', callback_data: 'create_community' }
              ]]
            }
          }
        );
      }

    } catch (joinError: any) {
      // Delete loading message
      await ctx.deleteMessage(loadingMessage.message_id);

      let errorMessage = '❌ **Failed to Join Community**\n\n';

      if (joinError.message?.includes('already a member')) {
        errorMessage += 'You are already a member of this community.';
      } else if (joinError.message?.includes('pending')) {
        errorMessage += 'You already have a pending join request for this community.';
      } else if (joinError.message?.includes('banned')) {
        errorMessage += 'You have been banned from this community.';
      } else {
        errorMessage += 'An unexpected error occurred. Please try again later.';
      }

      await ctx.reply(errorMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🏘️ Browse Communities', callback_data: 'communities' }
          ]]
        }
      });
    }

  } catch (error) {
    logger.error('Join command failed:', error);
    await ctx.reply(
      '❌ **Error**\n\n' +
      'Failed to process join request. Please try again later.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🏘️ Browse Communities', callback_data: 'communities' }
          ]]
        }
      }
    );
  }
}

// Helper function to extract slug from join command text
export function parseJoinCommand(text: string): string | undefined {
  // Remove the command and get the slug
  const parts = text.split(' ');
  if (parts.length < 2) {
    return undefined;
  }
  
  // Join all parts after the command in case there are spaces (though slugs shouldn't have spaces)
  const slug = parts.slice(1).join(' ').trim().toLowerCase();
  
  // Return undefined if empty
  return slug || undefined;
}