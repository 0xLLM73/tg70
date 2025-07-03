import { validateEmail, maskEmail } from '../utils/emailValidator.js';
import { canSendMagicLink, consumeMagicLinkRequest } from '../services/rateLimiter.js';
import { sendMagicLink, getLinkStatus } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/index.js';

/**
 * /link command handler
 * Magic-link authentication flow with state machine
 */
export async function linkCommand(ctx: BotContext): Promise<void> {
  const user = ctx.from;
  
  if (!user) {
    await ctx.reply('❌ Unable to identify user for linking');
    return;
  }

  try {
    // Check if user is already linked
    const linkStatus = await getLinkStatus(user.id);
    
    if (linkStatus.isLinked && linkStatus.email) {
      await ctx.reply(
        `✅ Your account is already linked!\n\n` +
        `📧 Email: ${maskEmail(linkStatus.email)}\n` +
        `👤 Role: ${linkStatus.user?.role || 'user'}\n\n` +
        `Use /link_status to see your full link status.`,
        ctx.message?.message_id ? {
          reply_parameters: { message_id: ctx.message.message_id },
        } : {}
      );
      return;
    }

    // Check current state
    const currentStep = ctx.session.step;
    
    if (currentStep === 'awaiting_email') {
      // User is in email input mode
      await handleEmailInput(ctx);
      return;
    }

    // Start the linking process
    await startLinkingProcess(ctx);
  } catch (error) {
    logger.error('Error in link command:', error);
    await ctx.reply(
      '❌ An error occurred while processing your request.\n\n' +
      'Please try again later or contact support if the problem persists.',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
  }
}

/**
 * Start the linking process - initial state
 */
async function startLinkingProcess(ctx: BotContext): Promise<void> {
  // Set state to awaiting email
  ctx.session.step = 'awaiting_email';
  ctx.session.data = {
    linkingStarted: new Date().toISOString(),
  };

  const firstName = ctx.from?.first_name || ctx.from?.username || 'there';

  await ctx.reply(
    `🔗 **Link Your Account**\n\n` +
    `Hi ${firstName}! Let's connect your Telegram account with your email address.\n\n` +
    `📧 **Please send me your email address:**\n` +
    `• Make sure it's spelled correctly\n` +
    `• You'll receive a magic link to verify\n` +
    `• The link expires in 24 hours\n\n` +
    `Type your email address now, or send /cancel to stop.`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle email input from user
 */
async function handleEmailInput(ctx: BotContext): Promise<void> {
  const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  
  if (!messageText) {
    await ctx.reply(
      '📧 Please send me your email address as a text message.\n\n' +
      'Example: user@example.com\n\n' +
      'Or send /cancel to stop the linking process.'
    );
    return;
  }

  // Check for cancel command
  if (messageText.toLowerCase().startsWith('/cancel')) {
    await cancelLinking(ctx);
    return;
  }

  // Validate email
  const emailValidation = validateEmail(messageText);
  
  if (!emailValidation.isValid) {
    await ctx.reply(
      `❌ **Invalid Email Address**\n\n` +
      `${emailValidation.error}\n\n` +
      `Please send a valid email address, or send /cancel to stop.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const email = emailValidation.normalizedEmail!;
  const telegramId = ctx.from!.id;

  // Check rate limiting
  const rateLimitCheck = await canSendMagicLink(telegramId, email);
  
  if (!rateLimitCheck.allowed) {
    await ctx.reply(
      rateLimitCheck.message || 'Rate limit exceeded. Please try again later.',
      ctx.message?.message_id ? {
        reply_parameters: { message_id: ctx.message.message_id },
      } : {}
    );
    
    // Reset state
    ctx.session.step = undefined;
    ctx.session.data = {};
    return;
  }

  // Send magic link
  await sendMagicLinkToUser(ctx, email);
}

/**
 * Send magic link to user's email
 */
async function sendMagicLinkToUser(ctx: BotContext, email: string): Promise<void> {
  const user = ctx.from!;
  
  try {
    // Update state to sending
    ctx.session.step = 'sending_link';
    ctx.session.linkingEmail = email;
    ctx.session.linkingExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await ctx.reply(
      `📤 **Sending Magic Link...**\n\n` +
      `📧 Email: ${maskEmail(email)}\n` +
      `⏳ Please wait...`,
      { parse_mode: 'Markdown' }
    );

    // Consume rate limit point
    await consumeMagicLinkRequest(user.id, email);

    // Send the magic link
    const magicLinkResult = await sendMagicLink({
      telegram_id: user.id,
      email,
      username: user.username,
      first_name: user.first_name,
    });

    if (!magicLinkResult.success) {
      await ctx.reply(
        `❌ **Failed to Send Magic Link**\n\n` +
        `${magicLinkResult.error}\n\n` +
        `Please try again in a few minutes.`,
        { parse_mode: 'Markdown' }
      );
      
      // Reset state
      ctx.session.step = undefined;
      ctx.session.data = {};
      ctx.session.linkingEmail = undefined;
      ctx.session.linkingExpiry = undefined;
      return;
    }

    // Success!
    ctx.session.step = 'awaiting_verification';
    
    await ctx.reply(
      `✅ **Magic Link Sent!**\n\n` +
      `📧 Check your email: ${maskEmail(email)}\n\n` +
      `📋 **Next Steps:**\n` +
      `1. Check your email inbox (and spam folder)\n` +
      `2. Click the magic link in the email\n` +
      `3. You'll be redirected to complete linking\n` +
      `4. Return here for confirmation\n\n` +
      `⏰ Link expires in 24 hours\n` +
      `🔄 Use /link_status to check progress\n\n` +
      `💡 **Tip:** Magic links are limited to 3 per hour per email address.`,
      { parse_mode: 'Markdown' }
    );

    logger.info(`Magic link sent to ${email} for Telegram user ${user.id} (${user.username})`);
  } catch (error) {
    logger.error('Error sending magic link:', error);
    
    await ctx.reply(
      `❌ **Error Sending Magic Link**\n\n` +
      `Something went wrong while sending the email.\n` +
      `Please try again in a few minutes.`,
      { parse_mode: 'Markdown' }
    );
    
    // Reset state
    ctx.session.step = undefined;
    ctx.session.data = {};
    ctx.session.linkingEmail = undefined;
    ctx.session.linkingExpiry = undefined;
  }
}

/**
 * Cancel the linking process
 */
async function cancelLinking(ctx: BotContext): Promise<void> {
  // Reset state
  ctx.session.step = undefined;
  ctx.session.data = {};
  ctx.session.linkingEmail = undefined;
  ctx.session.linkingExpiry = undefined;

  await ctx.reply(
    `❌ **Linking Cancelled**\n\n` +
    `No worries! You can start the linking process again anytime with /link.`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle text messages when user is in linking flow
 */
export async function handleLinkingFlow(ctx: BotContext): Promise<boolean> {
  const currentStep = ctx.session.step;
  
  if (currentStep === 'awaiting_email') {
    await handleEmailInput(ctx);
    return true; // Message was handled
  }
  
  return false; // Message not handled by linking flow
}