import { testConnection } from '../services/database.js';
import { testRedisConnection } from '../services/session.js';
import { getRateLimiterStatus } from '../services/rateLimiter.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * /test command handler
 * Test bot functionality and system status
 */
export async function testCommand(ctx: BotContext): Promise<void> {
  const user = ctx.from;
  
  if (!user) {
    await ctx.reply('❌ Unable to identify user for testing');
    return;
  }

  try {
    // Test database connection
    const dbStatus = await testConnection();
    
    // Test Redis connection
    const redisStatus = await testRedisConnection();
    
    // Get rate limiter status
    const rateLimiterStatus = await getRateLimiterStatus(user.id);
    
    // Session test
    const sessionData = ctx.session;
    const sessionStatus = sessionData && sessionData.userId === user.id;
    
    const statusMessage = 
      `🧪 **Cabal.Ventures Bot Test Results**\n\n` +
      `**System Status:**\n` +
      `• Database: ${dbStatus ? '✅ Connected' : '❌ Error'}\n` +
      `• Redis: ${redisStatus ? '✅ Connected' : '❌ Error'}\n` +
      `• Sessions: ${sessionStatus ? '✅ Working' : '❌ Error'}\n\n` +
      `**Rate Limiting:**\n` +
      `• Remaining requests: ${rateLimiterStatus.remainingPoints}/30\n` +
      `• Status: ${rateLimiterStatus.isBlocked ? '🚫 Blocked' : '✅ Active'}\n\n` +
      `**User Info:**\n` +
      `• ID: ${user.id}\n` +
      `• Username: ${user.username || 'Not set'}\n` +
      `• Name: ${user.first_name || 'Not set'}\n\n` +
      `**Session Data:**\n` +
      `• User ID: ${sessionData.userId}\n` +
      `• Last Activity: ${sessionData.lastActivity.toISOString()}\n` +
      `• Current Step: ${sessionData.step || 'None'}\n\n` +
      `${dbStatus && redisStatus ? '🎉 All systems operational!' : '⚠️ Some systems need attention'}`;

    await ctx.reply(statusMessage, {
      parse_mode: 'Markdown',
    });
    
    logger.info(`Test command executed by user: ${user.username || user.id}`);
  } catch (error) {
    logger.error('Error in test command:', error);
    await ctx.reply(
      '❌ Test failed! There was an error checking system status.\n\n' +
      'Please try again later or contact support if the problem persists.'
    );
  }
}