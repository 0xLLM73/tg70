/**
 * Communities discovery command - Browse and discover communities
 */

import { Context } from 'telegraf';
import { CommunityService } from '../services/communityService.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../services/database.js';
import { BotContext } from '../types/index.js';

interface SessionData {
  communitiesPage?: number;
  communitiesSort?: 'newest' | 'popular' | 'alphabetical';
  communitiesSearch?: string;
  communitiesWaitingForSearch?: boolean;
}

export async function communitiesCommand(ctx: BotContext): Promise<void> {
  try {
    // Check if user is authenticated
    const sessionUser = ctx.session?.user;
    if (!sessionUser) {
      await ctx.reply('🔐 Please authenticate first using /start');
      return;
    }

    // Initialize session data extension
    const sessionData = ctx.session as SessionData & typeof ctx.session;
    sessionData.communitiesPage = 0;
    sessionData.communitiesSort = 'newest';
    sessionData.communitiesSearch = undefined;

    // Show communities list
    await showCommunitiesList(ctx, sessionUser.id);

  } catch (error) {
    logger.error('Communities command failed:', error);
    await ctx.reply('❌ Failed to load communities. Please try again.');
  }
}

async function showCommunitiesList(ctx: BotContext, userId: string) {
  try {
    const sessionData = ctx.session as SessionData;
    const page = sessionData.communitiesPage || 0;
    const sort = sessionData.communitiesSort || 'newest';
    const search = sessionData.communitiesSearch;
    
    const limit = 5; // Show 5 communities per page
    const offset = page * limit;

    // Get communities
    const { communities, hasMore } = await CommunityService.list({
      limit,
      offset,
      search,
      sort,
    }, userId);

    // Format message
    let message = '🏘️ **Community Discovery**\n\n';
    
    if (search) {
      message += `🔍 Search: "${search}"\n\n`;
    }

    if (communities.length === 0) {
      message += search 
        ? '🤷‍♂️ No communities found matching your search.'
        : '📭 No communities available yet.';
    } else {
      communities.forEach((community, index) => {
        const memberText = community.member_count === 1 ? 'member' : 'members';
        const postText = community.post_count === 1 ? 'post' : 'posts';
        const privacyIcon = community.is_private ? '🔒' : '🌍';
        
        message += `${privacyIcon} **${community.name}**\n`;
        message += `📛 \`${community.slug}\`\n`;
        
        if (community.description) {
          const shortDesc = community.description.length > 100 
            ? community.description.substring(0, 100) + '...'
            : community.description;
          message += `📝 ${shortDesc}\n`;
        }
        
        message += `👥 ${community.member_count} ${memberText} • 📄 ${community.post_count} ${postText}\n`;
        message += `📅 Created ${new Date(community.created_at).toLocaleDateString()}\n\n`;
      });

      // Page info
      const totalPages = Math.ceil((offset + communities.length + (hasMore ? 1 : 0)) / limit);
      message += `📄 Page ${page + 1}${totalPages > 1 ? ` of ${totalPages}+` : ''}\n`;
      message += `📊 Sort: ${sort === 'newest' ? '🆕 Newest' : sort === 'popular' ? '🔥 Popular' : '🔤 A-Z'}\n`;
    }

    // Create inline keyboard
    const keyboard = [];

    // Navigation buttons
    const navRow = [];
    if (page > 0) {
      navRow.push({ text: '⬅️ Previous', callback_data: 'communities_prev' });
    }
    if (hasMore) {
      navRow.push({ text: 'Next ➡️', callback_data: 'communities_next' });
    }
    if (navRow.length > 0) {
      keyboard.push(navRow);
    }

    // Sort buttons
    const sortRow = [];
    if (sort !== 'newest') {
      sortRow.push({ text: '🆕 Newest', callback_data: 'communities_sort_newest' });
    }
    if (sort !== 'popular') {
      sortRow.push({ text: '🔥 Popular', callback_data: 'communities_sort_popular' });
    }
    if (sort !== 'alphabetical') {
      sortRow.push({ text: '🔤 A-Z', callback_data: 'communities_sort_alphabetical' });
    }
    if (sortRow.length > 0) {
      keyboard.push(sortRow);
    }

    // Action buttons
    keyboard.push([
      { text: '🔍 Search', callback_data: 'communities_search' },
      { text: '➕ Create', callback_data: 'create_community' },
    ]);

    if (search) {
      keyboard.push([{ text: '❌ Clear Search', callback_data: 'communities_clear_search' }]);
    }

    keyboard.push([
      { text: '🏠 Main Menu', callback_data: 'main_menu' },
    ]);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });

  } catch (error) {
    logger.error('Failed to show communities list:', error);
    await ctx.reply('❌ Failed to load communities. Please try again.');
  }
}

// Handle callback queries for communities discovery
export async function handleCommunitiesCallback(ctx: BotContext) {
  try {
    const callbackData = (ctx.callbackQuery as any)?.data;
    const sessionUser = ctx.session?.user;

    if (!sessionUser) {
      return ctx.answerCbQuery('Please authenticate first');
    }

    const sessionData = ctx.session as SessionData & typeof ctx.session;

    switch (callbackData) {
      case 'communities_prev':
        sessionData.communitiesPage = Math.max(0, (sessionData.communitiesPage || 0) - 1);
        await ctx.editMessageText('🔄 Loading...', { parse_mode: 'Markdown' });
        await showCommunitiesList(ctx, sessionUser.id);
        break;

      case 'communities_next':
        sessionData.communitiesPage = (sessionData.communitiesPage || 0) + 1;
        await ctx.editMessageText('🔄 Loading...', { parse_mode: 'Markdown' });
        await showCommunitiesList(ctx, sessionUser.id);
        break;

      case 'communities_sort_newest':
        sessionData.communitiesSort = 'newest';
        sessionData.communitiesPage = 0;
        await ctx.editMessageText('🔄 Loading...', { parse_mode: 'Markdown' });
        await showCommunitiesList(ctx, sessionUser.id);
        break;

      case 'communities_sort_popular':
        sessionData.communitiesSort = 'popular';
        sessionData.communitiesPage = 0;
        await ctx.editMessageText('🔄 Loading...', { parse_mode: 'Markdown' });
        await showCommunitiesList(ctx, sessionUser.id);
        break;

      case 'communities_sort_alphabetical':
        sessionData.communitiesSort = 'alphabetical';
        sessionData.communitiesPage = 0;
        await ctx.editMessageText('🔄 Loading...', { parse_mode: 'Markdown' });
        await showCommunitiesList(ctx, sessionUser.id);
        break;

      case 'communities_search':
        await ctx.editMessageText('🔍 **Search Communities**\n\nPlease send me a search term to find communities by name or description.\n\nYou can also send "cancel" to go back.', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '❌ Cancel', callback_data: 'communities_search_cancel' }
            ]]
          }
        });
        sessionData.communitiesWaitingForSearch = true;
        break;

      case 'communities_search_cancel':
        sessionData.communitiesWaitingForSearch = false;
        await showCommunitiesList(ctx, sessionUser.id);
        break;

      case 'communities_clear_search':
        sessionData.communitiesSearch = undefined;
        sessionData.communitiesPage = 0;
        await ctx.editMessageText('🔄 Loading...', { parse_mode: 'Markdown' });
        await showCommunitiesList(ctx, sessionUser.id);
        break;

      default:
        return ctx.answerCbQuery('Unknown action');
    }

    await ctx.answerCbQuery();

  } catch (error) {
    logger.error('Communities callback failed:', error);
    await ctx.answerCbQuery('❌ Action failed');
  }
}

// Handle search input
export async function handleCommunitiesSearch(ctx: BotContext, message: string) {
  try {
    const sessionUser = ctx.session?.user;
    if (!sessionUser) return;

    const sessionData = ctx.session as SessionData & typeof ctx.session;
    if (!sessionData.communitiesWaitingForSearch) return;

    sessionData.communitiesWaitingForSearch = false;

    if (message.toLowerCase() === 'cancel') {
      await showCommunitiesList(ctx, sessionUser.id);
      return;
    }

    // Set search term and reset page
    sessionData.communitiesSearch = message.trim();
    sessionData.communitiesPage = 0;

    // Show results
    await ctx.reply('🔍 Searching...', { parse_mode: 'Markdown' });
    await showCommunitiesList(ctx, sessionUser.id);

  } catch (error) {
    logger.error('Communities search failed:', error);
    await ctx.reply('❌ Search failed. Please try again.');
  }
}