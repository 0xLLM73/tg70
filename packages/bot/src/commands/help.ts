import type { BotContext } from '../types/index.js';

/**
 * /help command handler
 * Show available commands with Cabal.Ventures branding
 */
export async function helpCommand(ctx: BotContext): Promise<void> {
  const helpMessage = 
    `🤖 **Cabal.Ventures Bot Help**\n\n` +
    `I'm here to connect you with exclusive crypto communities and NFT collections!\n\n` +
    `📋 **Available Commands:**\n` +
    `• /start - Get started and see welcome message\n` +
    `• /help - Show this help message\n` +
    `• /test - Test bot functionality\n\n` +
    `🌟 **What I Do:**\n` +
    `• Connect you with invite-only Web3 groups\n` +
    `• Help you discover exclusive NFT communities\n` +
    `• Keep you updated on crypto opportunities\n` +
    `• Facilitate networking with crypto enthusiasts\n\n` +
    `💡 **Tips:**\n` +
    `• Just start chatting with me for personalized help\n` +
    `• I'm always learning and improving\n` +
    `• Your privacy and security are my priority\n\n` +
    `🚀 Ready to dive into the world of exclusive crypto communities?\n\n` +
    `*Powered by Cabal.Ventures - Your trusted crypto community connector*`;

  await ctx.reply(helpMessage, {
    parse_mode: 'Markdown',
  });
}