import type { BotContext } from '../types/index.js';

/**
 * /help command handler
 * Show available commands with Cabal.Ventures branding
 */
export async function helpCommand(ctx: BotContext): Promise<void> {
  const isLinked = ctx.session?.user?.email ? true : false;
  const userName = ctx.from?.first_name || ctx.from?.username || 'there';

  let helpMessage = `🤖 **Cabal.Ventures Bot Help**\n\n`;
  helpMessage += `Hi ${userName}! I'm here to connect you with exclusive crypto communities.\n\n`;
  
  helpMessage += `📋 **Basic Commands:**\n`;
  helpMessage += `• /start - Get started and welcome message\n`;
  helpMessage += `• /help - Show this help message\n`;
  helpMessage += `• /test - Test bot functionality\n`;
  helpMessage += `• /link - Link your email for full access\n`;
  helpMessage += `• /link_status - Check your link status\n\n`;

  if (isLinked) {
    helpMessage += `�️ **Community Commands:**\n`;
    helpMessage += `• /communities - Browse and discover communities\n`;
    helpMessage += `• /join <slug> - Join a community by slug\n`;
    helpMessage += `• /create_community - Create a new community\n\n`;

    helpMessage += `🌟 **What You Can Do:**\n`;
    helpMessage += `• Discover and join exclusive crypto communities\n`;
    helpMessage += `• Create your own private or public communities\n`;
    helpMessage += `• Network with verified crypto enthusiasts\n`;
    helpMessage += `• Access invite-only Web3 groups\n\n`;

    helpMessage += `💡 **Pro Tips:**\n`;
    helpMessage += `• Use /communities to explore all available communities\n`;
    helpMessage += `• Search communities by name or topic\n`;
    helpMessage += `• Create both public and private communities\n`;
    helpMessage += `• Your community membership is tracked securely\n\n`;
  } else {
    helpMessage += `🔐 **Get Full Access:**\n`;
    helpMessage += `Link your email with /link to unlock:\n`;
    helpMessage += `• Browse and join communities\n`;
    helpMessage += `• Create your own communities\n`;
    helpMessage += `• Post and comment in discussions\n`;
    helpMessage += `• Access exclusive crypto groups\n\n`;

    helpMessage += `🌟 **Why Link Your Account:**\n`;
    helpMessage += `• Secure, verified access to communities\n`;
    helpMessage += `• Track your community memberships\n`;
    helpMessage += `• Get notified of important updates\n`;
    helpMessage += `• Connect with verified crypto enthusiasts\n\n`;
  }

  helpMessage += `🚀 Ready to dive into exclusive crypto communities?\n\n`;
  helpMessage += `*Powered by Cabal.Ventures - Your trusted crypto community connector*`;

  await ctx.reply(helpMessage, {
    parse_mode: 'Markdown',
  });
}