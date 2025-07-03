import { getRoleDisplayName, isAdmin } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * /admin_panel command handler
 * Role-gated admin tools for site administrators
 */
export async function adminPanelCommand(ctx: BotContext): Promise<void> {
  const user = ctx.from;
  const sessionUser = ctx.session.user;
  
  if (!user) {
    await ctx.reply('❌ Unable to identify user');
    return;
  }

  try {
    // Check if user is authenticated and has admin role
    if (!sessionUser) {
      await ctx.reply(
        '🔐 **Authentication Required**\n\n' +
        'You need to link your account first to access admin tools.\n\n' +
        'Use /link to connect your Telegram account.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (!isAdmin(ctx)) {
      await ctx.reply(
        '🚫 **Access Denied**\n\n' +
        'This command requires Site Administrator privileges.\n\n' +
        `Your current role: ${getRoleDisplayName(sessionUser.role)}`,
        { parse_mode: 'Markdown' }
      );
      
      logger.warn(`Access denied to admin panel for user ${sessionUser.id} (${user.username}) - role: ${sessionUser.role}`);
      return;
    }

    // Display admin panel
    await displayAdminPanel(ctx);
  } catch (error) {
    logger.error('Error in admin_panel command:', error);
    await ctx.reply(
      '❌ Error loading admin panel.\n\n' +
      'Please try again later.',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  }
}

/**
 * Display admin panel interface
 */
async function displayAdminPanel(ctx: BotContext): Promise<void> {
  const sessionUser = ctx.session.user!;
  const firstName = ctx.from?.first_name || ctx.from?.username || 'Admin';

  let panelMessage = `🔱 **Admin Panel**\n\n`;
  panelMessage += `Welcome ${firstName}!\n`;
  panelMessage += `Role: ${getRoleDisplayName(sessionUser.role)}\n\n`;

  panelMessage += `📊 **System Information:**\n`;
  panelMessage += `• Environment: ${process.env.NODE_ENV || 'development'}\n`;
  panelMessage += `• Version: 0.1.0\n`;
  panelMessage += `• Uptime: ${formatUptime(process.uptime())}\n\n`;

  panelMessage += `🛠 **Available Admin Tools:**\n\n`;
  
  panelMessage += `**User Management:**\n`;
  panelMessage += `• Use CLI tools for role management\n`;
  panelMessage += `• Check audit logs in database\n`;
  panelMessage += `• Monitor auth events\n\n`;
  
  panelMessage += `**System Management:**\n`;
  panelMessage += `• /test - System status check\n`;
  panelMessage += `• Check Redis session store\n`;
  panelMessage += `• Monitor rate limiting\n\n`;
  
  panelMessage += `**Database Access:**\n`;
  panelMessage += `• Full RLS bypass with service role\n`;
  panelMessage += `• Direct access to all user data\n`;
  panelMessage += `• Audit event monitoring\n\n`;

  panelMessage += `**CLI Commands:**\n`;
  panelMessage += `\`\`\`bash\n`;
  panelMessage += `# Set user role (from project root)\n`;
  panelMessage += `pnpm role:set <user_id> <role>\n`;
  panelMessage += `pnpm role:list\n`;
  panelMessage += `pnpm audit:events\n`;
  panelMessage += `\`\`\`\n\n`;

  panelMessage += `**Quick Actions:**\n`;
  panelMessage += `• Send /test to verify all systems\n`;
  panelMessage += `• Check logs for recent activity\n`;
  panelMessage += `• Monitor magic link rate limits\n\n`;

  panelMessage += `⚠️ **Security Reminder:**\n`;
  panelMessage += `• All admin actions are logged\n`;
  panelMessage += `• Use CLI tools for sensitive operations\n`;
  panelMessage += `• Regular security audits recommended\n`;

  await ctx.reply(panelMessage, { parse_mode: 'Markdown' });
  
  logger.info(`Admin panel accessed by user ${sessionUser.id} (${ctx.from?.username})`);
}

/**
 * Format uptime in human readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}