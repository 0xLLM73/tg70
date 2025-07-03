/**
 * DEBUG TEST: Figure out why interceptors aren't working
 */

/// <reference types="jest" />

import { Telegraf } from 'telegraf';
import { createBot } from '../../bot.js';
import { testCommand } from '../../commands/test.js';
import {
  setupInterceptors,
  simulateUserMessage,
  getInterceptedCalls,
  getInterceptedMessages,
  clearInterceptedData,
  incomingInterceptor,
} from '../interceptors.js';
import type { BotContext } from '../../types/index.js';

// Use interceptor setup
import '../interceptor-setup.js';

describe('DEBUG: Why interceptors are not working', () => {
  beforeEach(() => {
    clearInterceptedData();
  });

  it('should test direct command execution', async () => {
    console.log('\n=== DIRECT COMMAND TEST ===');
    
    // Test calling the command directly
    const mockContext = {
      from: { id: 12345, username: 'debug_user', first_name: 'Debug' },
      reply: jest.fn().mockResolvedValue({ message_id: 123 }),
      session: {
        userId: 12345,
        lastActivity: new Date(),
        user: {
          id: 'debug-user-id',
          telegram_id: 12345,
          email: 'debug@example.com',
          username: 'debug_user',
          first_name: 'Debug',
          role: 'user' as const,
        },
      },
    } as any;
    
    await testCommand(mockContext);
    
    console.log('Direct command called reply:', mockContext.reply.mock.calls.length > 0);
    console.log('Message text sample:', mockContext.reply.mock.calls[0]?.[0]?.substring(0, 50));
    
    expect(mockContext.reply).toHaveBeenCalled();
  });

  it('should test bot command registration', async () => {
    console.log('\n=== BOT COMMAND REGISTRATION TEST ===');
    
    const bot = createBot();
    
    // Check if the bot has the test command registered
    console.log('Bot middleware count:', (bot as any).middleware?.length || 0);
    console.log('Bot has listeners:', typeof (bot as any).handleUpdate === 'function');
    
    // Set up interceptors
    setupInterceptors(bot);
    
    console.log('Interceptors set up');
    
    // Test a simple update
    const mockUpdate = {
      update_id: 123,
      message: {
        message_id: 456,
        from: {
          id: 12345,
          is_bot: false,
          first_name: 'Debug',
          username: 'debug_user',
          language_code: 'en',
        },
        chat: {
          id: 12345,
          type: 'private' as const,
          first_name: 'Debug',
          username: 'debug_user',
        },
        date: Math.floor(Date.now() / 1000),
        text: '/test',
      },
    };
    
    try {
      await bot.handleUpdate(mockUpdate);
      console.log('Bot processed update successfully');
    } catch (error) {
      console.log('Bot update error:', error);
    }
    
    const interceptedCalls = getInterceptedCalls();
    const interceptedMessages = getInterceptedMessages();
    
    console.log('Intercepted calls count:', interceptedCalls.length);
    console.log('Intercepted messages count:', interceptedMessages.length);
    
    if (interceptedCalls.length > 0) {
      console.log('First intercepted call:', interceptedCalls[0]);
    }
    
    if (interceptedMessages.length > 0) {
      console.log('First intercepted message:', interceptedMessages[0]);
    }
    
    // At minimum, we should see some activity
    expect(interceptedCalls.length + interceptedMessages.length).toBeGreaterThan(0);
  });

  it('should test if API calls are being made', async () => {
    console.log('\n=== API CALL TEST ===');
    
    const bot = createBot();
    setupInterceptors(bot);
    
    // Try to trigger a manual API call
    try {
      const result = await bot.telegram.callApi('getMe', {});
      console.log('Manual API call result:', result);
    } catch (error) {
      console.log('Manual API call error:', error);
    }
    
    const interceptedCalls = getInterceptedCalls();
    console.log('Intercepted API calls:', interceptedCalls.length);
    
    if (interceptedCalls.length > 0) {
      console.log('Intercepted call details:', interceptedCalls[0]);
    }
    
    expect(interceptedCalls.length).toBeGreaterThan(0);
  });

  it('should test manual bot creation with interceptor first', async () => {
    console.log('\n=== MANUAL BOT CREATION TEST ===');
    
    // Create bot manually and add interceptor FIRST
    const { config } = await import('../../config/index.js');
    const bot = new Telegraf<BotContext>(config.BOT_TOKEN);
    
    // Add interceptor middleware FIRST
    bot.use(incomingInterceptor());
    console.log('Added interceptor middleware first');
    
    // Add a simple test command
    bot.command('test', async (ctx) => {
      console.log('Manual test command triggered');
      await ctx.reply('Manual test response');
    });
    
    console.log('Bot created and configured manually');
    
    // Setup API interceptors
    const originalCallApi = bot.telegram.callApi.bind(bot.telegram);
    const { outgoingInterceptor } = await import('../interceptors.js');
    const newCallApi = outgoingInterceptor(originalCallApi);
    bot.telegram.callApi = newCallApi.bind(bot.telegram);
    
    console.log('API interceptors set up');
    
    // Test a simple update
    const mockUpdate = {
      update_id: 999,
      message: {
        message_id: 888,
        from: {
          id: 99999,
          is_bot: false,
          first_name: 'Manual',
          username: 'manual_user',
          language_code: 'en',
        },
        chat: {
          id: 99999,
          type: 'private' as const,
          first_name: 'Manual',
          username: 'manual_user',
        },
        date: Math.floor(Date.now() / 1000),
        text: '/test',
      },
    };
    
    try {
      await bot.handleUpdate(mockUpdate);
      console.log('Manual bot processed update successfully');
    } catch (error) {
      console.log('Manual bot update error:', error);
    }
    
    const interceptedCalls = getInterceptedCalls();
    const interceptedMessages = getInterceptedMessages();
    
    console.log('Manual test - Intercepted calls:', interceptedCalls.length);
    console.log('Manual test - Intercepted messages:', interceptedMessages.length);
    
    for (let i = 0; i < interceptedMessages.length; i++) {
      console.log(`Message ${i}:`, interceptedMessages[i]);
    }
    
    for (let i = 0; i < interceptedCalls.length; i++) {
      console.log(`Call ${i}:`, interceptedCalls[i]);
    }
    
    // Should have at least captured something
    expect(interceptedCalls.length + interceptedMessages.length).toBeGreaterThanOrEqual(1);
  });
});