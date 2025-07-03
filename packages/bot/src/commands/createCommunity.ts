/**
 * Community Creation Wizard Command
 * 5-step flow for creating communities
 */

import type { BotContext } from '../types/index.js';
import { CommunityService } from '../services/communityService.js';
import { logger } from '../utils/logger.js';

interface CommunityCreationFlow {
  step: 1 | 2 | 3 | 4 | 5;
  data: {
    slug?: string;
    name?: string;
    description?: string;
    is_private?: boolean;
  };
}

/**
 * Start community creation wizard
 */
export async function createCommunityCommand(ctx: BotContext): Promise<void> {
  try {
    // Check if user is authenticated
    if (!ctx.session.user) {
      await ctx.reply(
        '🔒 You need to link your account first to create communities.\n\n' +
        'Use /link to connect your account.',
        ctx.message?.message_id ? {
          reply_parameters: { message_id: ctx.message.message_id },
        } : {}
      );
      return;
    }

    // Initialize creation flow
    ctx.session.communityCreation = {
      step: 1,
      data: {}
    };

    await showStep1(ctx);
  } catch (error) {
    logger.error('Create community command error:', error);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}

/**
 * Handle messages during community creation flow
 */
export async function handleCommunityCreationFlow(ctx: BotContext): Promise<boolean> {
  if (!ctx.session.communityCreation) {
    return false; // Not in creation flow
  }

  const flow = ctx.session.communityCreation;
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

  try {
    switch (flow.step) {
      case 1:
        return await handleStep1(ctx, text, flow);
      case 2:
        return await handleStep2(ctx, text, flow);
      case 3:
        return await handleStep3(ctx, text, flow);
      case 4:
        return await handleStep4(ctx, text, flow);
      case 5:
        return await handleStep5(ctx, text, flow);
      default:
        // Invalid step, reset flow
        delete ctx.session.communityCreation;
        return false;
    }
  } catch (error) {
    logger.error('Community creation flow error:', error);
    await ctx.reply('❌ Something went wrong. Let\'s start over with /create_community');
    delete ctx.session.communityCreation;
    return true;
  }
}

/**
 * Step 1: Enter community slug
 */
async function showStep1(ctx: BotContext): Promise<void> {
  const message = `🏗️ **Create New Community** (Step 1 of 5)\n\n` +
    `Let's create your community! I'll guide you through 5 simple steps.\n\n` +
    `**Step 1: Community Slug**\n` +
    `Choose a unique URL slug for your community.\n\n` +
    `**Requirements:**\n` +
    `• 3-50 characters\n` +
    `• Only lowercase letters, numbers, underscores, and hyphens\n` +
    `• Must be unique across all communities\n\n` +
    `**Examples:** \`crypto-trading\`, \`defi_builders\`, \`nft-collectors\`\n\n` +
    `Please enter your community slug:`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...(ctx.message?.message_id ? {
      reply_parameters: { message_id: ctx.message.message_id },
    } : {})
  });
}

async function handleStep1(ctx: BotContext, text: string, flow: CommunityCreationFlow): Promise<true> {
  // Validate slug format
  const slugRegex = /^[a-z0-9_-]+$/;
  
  if (!text || text.length < 3 || text.length > 50) {
    await ctx.reply('❌ Slug must be 3-50 characters long. Please try again:');
    return true;
  }

  if (!slugRegex.test(text)) {
    await ctx.reply('❌ Slug can only contain lowercase letters, numbers, underscores, and hyphens. Please try again:');
    return true;
  }

  try {
    // Check if slug is available
    const existingCommunity = await CommunityService.getBySlug(text);
    if (existingCommunity) {
      await ctx.reply(`❌ The slug "${text}" is already taken. Please choose a different one:`);
      return true;
    }

    // Slug is valid and available
    flow.data.slug = text;
    flow.step = 2;
    ctx.session.communityCreation = flow;

    await showStep2(ctx);
    return true;
  } catch (error) {
    logger.error('Slug validation error:', error);
    await ctx.reply('❌ Error checking slug availability. Please try again:');
    return true;
  }
}

/**
 * Step 2: Enter community name
 */
async function showStep2(ctx: BotContext): Promise<void> {
  const message = `✅ Great! Slug "${ctx.session.communityCreation!.data.slug}" is available.\n\n` +
    `🏗️ **Create New Community** (Step 2 of 5)\n\n` +
    `**Step 2: Community Name**\n` +
    `Choose a display name for your community.\n\n` +
    `**Requirements:**\n` +
    `• 3-100 characters\n` +
    `• Can contain spaces and special characters\n` +
    `• Should be descriptive and engaging\n\n` +
    `**Examples:** \`Crypto Trading Hub\`, \`DeFi Builders Alliance\`, \`NFT Collectors\`\n\n` +
    `Please enter your community name:`;

  await ctx.reply(message, {
    parse_mode: 'Markdown'
  });
}

async function handleStep2(ctx: BotContext, text: string, flow: CommunityCreationFlow): Promise<true> {
  if (!text || text.length < 3 || text.length > 100) {
    await ctx.reply('❌ Community name must be 3-100 characters long. Please try again:');
    return true;
  }

  flow.data.name = text.trim();
  flow.step = 3;
  ctx.session.communityCreation = flow;

  await showStep3(ctx);
  return true;
}

/**
 * Step 3: Enter community description
 */
async function showStep3(ctx: BotContext): Promise<void> {
  const message = `✅ Community name set: "${ctx.session.communityCreation!.data.name}"\n\n` +
    `🏗️ **Create New Community** (Step 3 of 5)\n\n` +
    `**Step 3: Community Description** (Optional)\n` +
    `Add a description to help people understand what your community is about.\n\n` +
    `**Requirements:**\n` +
    `• Up to 500 characters\n` +
    `• Can be skipped by sending "skip"\n\n` +
    `Please enter your community description (or send "skip"):`;

  await ctx.reply(message, {
    parse_mode: 'Markdown'
  });
}

async function handleStep3(ctx: BotContext, text: string, flow: CommunityCreationFlow): Promise<true> {
  if (text.toLowerCase() === 'skip') {
    // Skip description
    flow.data.description = undefined;
  } else {
    if (text.length > 500) {
      await ctx.reply('❌ Description must be less than 500 characters. Please try again (or send "skip"):');
      return true;
    }
    flow.data.description = text.trim();
  }

  flow.step = 4;
  ctx.session.communityCreation = flow;

  await showStep4(ctx);
  return true;
}

/**
 * Step 4: Choose privacy setting
 */
async function showStep4(ctx: BotContext): Promise<void> {
  const message = `${ctx.session.communityCreation!.data.description ? '✅ Description added' : '✅ Description skipped'}\n\n` +
    `🏗️ **Create New Community** (Step 4 of 5)\n\n` +
    `**Step 4: Privacy Setting**\n` +
    `Choose who can join your community.\n\n` +
    `**Options:**\n` +
    `🌍 **Public** - Anyone can join immediately\n` +
    `🔒 **Private** - Join requests require approval\n\n` +
    `Please choose:\n` +
    `• Send "public" for public community\n` +
    `• Send "private" for private community`;

  await ctx.reply(message, {
    parse_mode: 'Markdown'
  });
}

async function handleStep4(ctx: BotContext, text: string, flow: CommunityCreationFlow): Promise<true> {
  const choice = text.toLowerCase();
  
  if (choice === 'public') {
    flow.data.is_private = false;
  } else if (choice === 'private') {
    flow.data.is_private = true;
  } else {
    await ctx.reply('❌ Please send either "public" or "private":');
    return true;
  }

  flow.step = 5;
  ctx.session.communityCreation = flow;

  await showStep5(ctx);
  return true;
}

/**
 * Step 5: Review and confirm
 */
async function showStep5(ctx: BotContext): Promise<void> {
  const flow = ctx.session.communityCreation!;
  
  const message = `✅ Privacy setting: ${flow.data.is_private ? '🔒 Private' : '🌍 Public'}\n\n` +
    `🏗️ **Create New Community** (Step 5 of 5)\n\n` +
    `**Review Your Community:**\n\n` +
    `**Slug:** \`${flow.data.slug}\`\n` +
    `**Name:** ${flow.data.name}\n` +
    `**Description:** ${flow.data.description || 'None'}\n` +
    `**Privacy:** ${flow.data.is_private ? '🔒 Private (approval required)' : '🌍 Public (open to all)'}\n\n` +
    `**Ready to create your community?**\n` +
    `• Send "create" to create the community\n` +
    `• Send "cancel" to cancel\n` +
    `• Send "back" to go to previous step`;

  await ctx.reply(message, {
    parse_mode: 'Markdown'
  });
}

async function handleStep5(ctx: BotContext, text: string, flow: CommunityCreationFlow): Promise<true> {
  const choice = text.toLowerCase();
  
  if (choice === 'cancel') {
    delete ctx.session.communityCreation;
    await ctx.reply('❌ Community creation cancelled.');
    return true;
  }

  if (choice === 'back') {
    flow.step = 4;
    ctx.session.communityCreation = flow;
    await showStep4(ctx);
    return true;
  }

  if (choice === 'create') {
    try {
      // Create the community
      const community = await CommunityService.create(ctx.session.user!.id, {
        slug: flow.data.slug!,
        name: flow.data.name!,
        description: flow.data.description,
        is_private: flow.data.is_private,
      });

      // Clear creation flow
      delete ctx.session.communityCreation;

      // Success message
      const successMessage = `🎉 **Community Created Successfully!**\n\n` +
        `**${community.name}** is now live!\n\n` +
        `**Details:**\n` +
        `• **URL:** /join ${community.slug}\n` +
        `• **Privacy:** ${community.is_private ? '🔒 Private' : '🌍 Public'}\n` +
        `• **You are:** Admin\n\n` +
        `**Next Steps:**\n` +
        `• Share the join link with others\n` +
        `• Create your first post\n` +
        `• Set up community guidelines\n\n` +
        `**Commands:**\n` +
        `• \`/feed\` - View community feed\n` +
        `• \`/post\` - Create a new post\n` +
        `• \`/moderate\` - Access moderation tools`;

      await ctx.reply(successMessage, {
        parse_mode: 'Markdown'
      });

      logger.info(`Community "${community.slug}" created successfully by user ${ctx.session.user!.id}`);
      return true;
    } catch (error) {
      logger.error('Community creation failed:', error);
      
      if (error instanceof Error) {
        await ctx.reply(`❌ Failed to create community: ${error.message}`);
      } else {
        await ctx.reply('❌ Failed to create community. Please try again.');
      }
      
      delete ctx.session.communityCreation;
      return true;
    }
  }

  await ctx.reply('❌ Please send "create", "back", or "cancel":');
  return true;
}