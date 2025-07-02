import { Telegraf } from 'telegraf';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { sessionMiddleware } from './middleware/session.js';
import { rateLimiterMiddleware } from './services/rateLimiter.js';
import { errorHandler, asyncErrorHandler } from './middleware/errorHandler.js';
import { startCommand } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { testCommand } from './commands/test.js';
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
  bot.use(rateLimiterMiddleware);

  // Register commands with error handling
  bot.command('start', asyncErrorHandler(startCommand));
  bot.command('help', asyncErrorHandler(helpCommand));
  bot.command('test', asyncErrorHandler(testCommand));

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

    // Handle regular text messages
    await ctx.reply(
      '👋 Thanks for your message! I\'m still learning how to chat.\n\n' +
      'For now, try using one of my commands:\n' +
      '• /start - Get started\n' +
      '• /help - See available commands\n' +
      '• /test - Test bot functionality\n\n' +
      'More features coming soon! 🚀',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  }));

  // Handle other message types
  bot.on('message', asyncErrorHandler(async (ctx: BotContext) => {
    await ctx.reply(
      '📎 I received your message, but I can only handle text messages right now.\n\n' +
      'Please send me a text message or use one of my commands like /help.',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  }));

  logger.info('✅ Bot configured successfully');
  return bot;
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
    logger.info('🚀 Bot started in polling mode');
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