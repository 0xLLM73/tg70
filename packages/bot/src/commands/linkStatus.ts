import { getLinkStatus } from '../services/auth.js';
import { maskEmail } from '../utils/emailValidator.js';
import { getRoleDisplayName } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * /link_status command handler
 * Shows current link status with ✅/❌ indicators
 */
export async function linkStatusCommand(ctx: BotContext): Promise<void> {
  const user = ctx.from;
  
  if (!user) {
    await ctx.reply('❌ Unable to identify user');
    return;
  }

  try {
    // Get link status from database
    const linkStatus = await getLinkStatus(user.id);
    
    if (!linkStatus.isLinked || !linkStatus.user) {
      // User is not linked
      await displayUnlinkedStatus(ctx);
      return;
    }

    // User is linked - show full status
    await displayLinkedStatus(ctx, linkStatus);
  } catch (error) {
    logger.error('Error in link_status command:', error);
    await ctx.reply(
      '❌ Error retrieving link status.\n\n' +
      'Please try again later.',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  }
}

/**
 * Display status for unlinked user
 */
async function displayUnlinkedStatus(ctx: BotContext): Promise<void> {
  const currentStep = ctx.session.step;
  const linkingEmail = ctx.session.linkingEmail;
  const linkingExpiry = ctx.session.linkingExpiry;
  
  let statusMessage = `❌ **Account Not Linked**\n\n`;
  statusMessage += `🔗 **Link Status:** Not linked\n`;
  statusMessage += `📧 **Email:** None\n`;
  statusMessage += `👤 **Role:** Guest (no access)\n\n`;

  // Check if user is in the middle of linking process
  if (currentStep && linkingEmail) {
    const now = new Date();
    const expiry = linkingExpiry ? new Date(linkingExpiry) : null;
    const isExpired = expiry && now > expiry;
    
    statusMessage += `🔄 **Linking in Progress**\n`;
    statusMessage += `📧 Email: ${maskEmail(linkingEmail)}\n`;
    statusMessage += `⏰ Status: ${getStepDisplayName(currentStep)}\n`;
    
    if (expiry) {
      if (isExpired) {
        statusMessage += `🕐 Expired: ${expiry.toLocaleString()}\n\n`;
        statusMessage += `❌ Your linking session has expired. Use /link to start over.\n`;
      } else {
        const timeLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
        statusMessage += `🕐 Expires: In ${timeLeft} hours\n\n`;
        
        if (currentStep === 'awaiting_verification') {
          statusMessage += `📋 **Next:** Check your email and click the magic link!\n`;
        } else if (currentStep === 'awaiting_email') {
          statusMessage += `📋 **Next:** Send your email address to continue linking.\n`;
        }
      }
    }
  } else {
    statusMessage += `📋 **Next Steps:**\n`;
    statusMessage += `1. Use /link to start linking process\n`;
    statusMessage += `2. Enter your email address\n`;
    statusMessage += `3. Check email for magic link\n`;
    statusMessage += `4. Click link to complete setup\n`;
  }

  await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
}

/**
 * Display status for linked user
 */
async function displayLinkedStatus(ctx: BotContext, linkStatus: { user?: any; email?: string }): Promise<void> {
  const { user, email } = linkStatus;
  
  let statusMessage = `✅ **Account Successfully Linked**\n\n`;
  
  // Basic info
  statusMessage += `🔗 **Link Status:** ✅ Linked\n`;
  statusMessage += `📧 **Email:** ${email ? maskEmail(email) : 'Unknown'}\n`;
  statusMessage += `👤 **Role:** ${getRoleDisplayName(user.role)}\n`;
  
  // Account details
  if (user.username) {
    statusMessage += `🏷️ **Username:** @${user.username}\n`;
  }
  if (user.first_name) {
    statusMessage += `👋 **Name:** ${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}\n`;
  }
  
  // Timestamps
  if (user.last_login_at) {
    const lastLogin = new Date(user.last_login_at);
    statusMessage += `🕐 **Last Login:** ${lastLogin.toLocaleString()}\n`;
  }
  
  if (user.created_at) {
    const created = new Date(user.created_at);
    statusMessage += `📅 **Account Created:** ${created.toLocaleDateString()}\n`;
  }
  
  statusMessage += `\n`;
  
  // Role-specific information
  if (user.role === 'siteAdmin') {
    statusMessage += `🔱 **Admin Privileges:**\n`;
    statusMessage += `• Full system access\n`;
    statusMessage += `• User management\n`;
    statusMessage += `• Role assignment\n`;
    statusMessage += `• Use /admin_panel for admin tools\n`;
  } else if (user.role === 'communityAdmin') {
    statusMessage += `⚡ **Community Admin Privileges:**\n`;
    statusMessage += `• Community management\n`;
    statusMessage += `• Limited admin tools\n`;
  } else {
    statusMessage += `👤 **User Access:**\n`;
    statusMessage += `• Basic bot features\n`;
    statusMessage += `• Community participation\n`;
  }
  
  statusMessage += `\n📱 **Available Commands:**\n`;
  statusMessage += `• /help - See all commands\n`;
  statusMessage += `• /test - Test system status\n`;
  
  if (user.role === 'siteAdmin') {
    statusMessage += `• /admin_panel - Admin tools\n`;
  }

  await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
}

/**
 * Get display name for linking step
 */
function getStepDisplayName(step: string): string {
  const stepNames = {
    awaiting_email: '⏳ Waiting for email',
    sending_link: '📤 Sending magic link',
    awaiting_verification: '📧 Check your email',
    done: '✅ Complete',
  };
  
  return stepNames[step as keyof typeof stepNames] || step;
}