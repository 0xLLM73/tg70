import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * Global error handler middleware
 * Catches all unhandled errors and shows friendly message to users
 */
export async function errorHandler(err: unknown, ctx: BotContext): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  const userId = ctx.from?.id || 'unknown';
  const username = ctx.from?.username || ctx.from?.first_name || 'Unknown User';
  
  // Log the error with context
  logger.error('Bot error occurred:', {
    error: error.message,
    stack: error.stack,
    userId,
    username,
    chatId: ctx.chat?.id,
    messageText: ctx.message && 'text' in ctx.message ? ctx.message.text : undefined,
  });

  try {
    // Send friendly error message to user
    await ctx.reply(
      '😅 Something went wrong! Our team has been notified and we\'re looking into it.\n\n' +
      'Please try again in a moment. If the problem persists, you can contact our support team.',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  } catch (replyError) {
    // If we can't even send the error message, log it
    logger.error('Failed to send error message to user:', {
      originalError: error.message,
      replyError: replyError instanceof Error ? replyError.message : String(replyError),
      userId,
    });
  }
}

/**
 * Async error wrapper for command handlers
 */
export function asyncErrorHandler(
  handler: (ctx: BotContext) => Promise<void>
): (ctx: BotContext) => Promise<void> {
  return async (ctx: BotContext): Promise<void> => {
    try {
      await handler(ctx);
    } catch (error) {
      await errorHandler(error instanceof Error ? error : new Error(String(error)), ctx);
    }
  };
}