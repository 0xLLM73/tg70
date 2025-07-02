import { getOrCreateUser } from '../services/database.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * /start command handler
 * Welcome message with Cabal.Ventures branding
 */
export async function startCommand(ctx: BotContext): Promise<void> {
  const user = ctx.from;
  
  if (!user) {
    await ctx.reply('👋 Welcome to Cabal.Ventures 🤖');
    return;
  }

  try {
    // Create or update user in database
    await getOrCreateUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
    });

    // Reset session step
    ctx.session.step = undefined;
    ctx.session.data = {};

    const firstName = user.first_name || user.username || 'there';
    
    const welcomeMessage = 
      `👋 Welcome to Cabal.Ventures 🤖\n\n` +
      `Hi ${firstName}! I'm your gateway to exclusive crypto communities and NFT collections.\n\n` +
      `🚀 What I can help you with:\n` +
      `• Connect with invite-only Web3 groups\n` +
      `• Discover exclusive NFT communities\n` +
      `• Stay updated on the latest crypto opportunities\n` +
      `• Network with fellow crypto enthusiasts\n\n` +
      `Type /help to see all available commands or just start chatting with me!\n\n` +
      `Ready to explore the future of decentralized communities? Let's go! 🌟`;

    await ctx.reply(welcomeMessage);
    
    logger.info(`User started bot: ${user.username || user.id}`);
  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply(
      '👋 Welcome to Cabal.Ventures 🤖\n\n' +
      'Your gateway to exclusive crypto communities!\n\n' +
      'Use /help to see available commands.'
    );
  }
}