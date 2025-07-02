import { Telegraf } from 'telegraf';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { sessionMiddleware } from './middleware/session.js';
import { authMiddleware, addRoleAssertion } from './middleware/auth.js';
import { rateLimiterMiddleware } from './services/rateLimiter.js';
import { errorHandler, asyncErrorHandler } from './middleware/errorHandler.js';
import { startCommand } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { testCommand } from './commands/test.js';
import { linkCommand, handleLinkingFlow } from './commands/link.js';
import { linkStatusCommand } from './commands/linkStatus.js';
import { adminPanelCommand } from './commands/adminPanel.js';
import type { BotContext } from './types/index.js';

/**
 * Create and configure the Telegram bot
 */
export function createBot(): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(config.BOT_TOKEN);

  // Set up global error handler
  bot.catch(errorHandler);

  // Apply middleware in order
  bot.use(sessionMiddleware);
  bot.use(authMiddleware); // Load user data and handle session persistence
  bot.use(addRoleAssertion); // Add assertRole method to context
  bot.use(rateLimiterMiddleware);

  // Register commands with error handling
  bot.command('start', asyncErrorHandler(startCommand));
  bot.command('help', asyncErrorHandler(helpCommand));
  bot.command('test', asyncErrorHandler(testCommand));
  bot.command('link', asyncErrorHandler(linkCommand));
  bot.command('link_status', asyncErrorHandler(linkStatusCommand));
  bot.command('admin_panel', asyncErrorHandler(adminPanelCommand));

  // Handle unknown commands
  bot.on('text', asyncErrorHandler(async (ctx: BotContext) => {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    
    // Skip if it's a command we don't recognize
    if (text.startsWith('/')) {
      await ctx.reply(
        '🤔 I don\'t recognize that command.\n\n' +
        'Type /help to see all available commands.',
        ctx.message?.message_id ? {
          reply_parameters: { message_id: ctx.message.message_id },
        } : {}
      );
      return;
    }

    // Check if user is in linking flow
    const handledByLinking = await handleLinkingFlow(ctx);
    if (handledByLinking) {
      return; // Message was handled by linking flow
    }

    // Handle regular text messages
    const firstName = ctx.from?.first_name || ctx.from?.username || 'there';
    const isLinked = ctx.session.user?.email ? '✅' : '❌';
    
    await ctx.reply(
      `👋 Hi ${firstName}! Thanks for your message!\n\n` +
      `🔗 **Account Status:** ${isLinked} ${ctx.session.user?.email ? 'Linked' : 'Not linked'}\n\n` +
      `**Available Commands:**\n` +
      `• /help - See all commands\n` +
      `• /link - Link your account\n` +
      `• /link_status - Check link status\n` +
      `• /test - Test bot functionality\n\n` +
      `${ctx.session.user?.email ? '🎉' : '💡'} ${ctx.session.user?.email ? 'Your account is linked! You have full access to bot features.' : 'Link your account with /link to unlock all features!'}`,
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  }));

  // Handle other message types
  bot.on('message', asyncErrorHandler(async (ctx: BotContext) => {
    const messageType = getMessageType(ctx.message);
    
    await ctx.reply(
      `📎 I received your ${messageType}, but I can only handle text messages right now.\n\n` +
      `Please send me a text message or use one of my commands:\n` +
      `• /help - See available commands\n` +
      `• /link - Link your account\n` +
      `• /test - Test bot functionality`,
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  }));

  logger.info('✅ Bot configured successfully with auth system');
  return bot;
}

/**
 * Get human-readable message type
 */
function getMessageType(message: any): string {
  if ('photo' in message) return 'photo';
  if ('document' in message) return 'document';
  if ('video' in message) return 'video';
  if ('audio' in message) return 'audio';
  if ('voice' in message) return 'voice message';
  if ('sticker' in message) return 'sticker';
  if ('animation' in message) return 'GIF';
  if ('location' in message) return 'location';
  if ('contact' in message) return 'contact';
  if ('poll' in message) return 'poll';
  return 'message';
}

/**
 * Start the bot in polling mode
 */
export async function startPolling(bot: Telegraf<BotContext>): Promise<void> {
  try {
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    // Start polling
    await bot.launch();
    logger.info('🚀 Bot started in polling mode with magic-link auth');
  } catch (error) {
    logger.error('Failed to start bot in polling mode:', error);
    throw error;
  }
}

/**
 * Set up webhook for production
 */
export async function setupWebhook(bot: Telegraf<BotContext>): Promise<void> {
  if (!config.WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL is required for webhook mode');
  }

  try {
    // Set webhook
    await bot.telegram.setWebhook(config.WEBHOOK_URL);
    logger.info(`🔗 Webhook set to: ${config.WEBHOOK_URL}`);
  } catch (error) {
    logger.error('Failed to set webhook:', error);
    throw error;
  }
}