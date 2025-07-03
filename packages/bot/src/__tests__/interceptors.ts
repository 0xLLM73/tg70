/**
 * Telegram Bot Interceptors for Testing
 * Based on Singapore GDS approach, adapted for ES modules and TypeScript
 */

import type { Telegraf, Middleware } from 'telegraf';
import type { BotContext } from '../types/index.js';

// Types for intercepted data
export interface InterceptedCall {
  method: string;
  params: any[];
  timestamp: number;
  response?: any;
  error?: any;
}

export interface InterceptedMessage {
  type: 'incoming' | 'outgoing';
  method?: string;
  payload: any;
  timestamp: number;
  context?: Partial<BotContext>;
}

// Global storage for intercepted calls and messages
let interceptedCalls: InterceptedCall[] = [];
let interceptedMessages: InterceptedMessage[] = [];

/**
 * Clear all intercepted data (useful between tests)
 */
export function clearInterceptedData(): void {
  interceptedCalls = [];
  interceptedMessages = [];
}

/**
 * Get all intercepted API calls
 */
export function getInterceptedCalls(): InterceptedCall[] {
  return [...interceptedCalls];
}

/**
 * Get all intercepted messages
 */
export function getInterceptedMessages(): InterceptedMessage[] {
  return [...interceptedMessages];
}

/**
 * Get the last intercepted call of a specific method
 */
export function getLastCallOfMethod(method: string): InterceptedCall | undefined {
  return interceptedCalls
    .filter(call => call.method === method)
    .slice(-1)[0];
}

/**
 * Get all outgoing messages (replies from bot)
 */
export function getOutgoingMessages(): InterceptedMessage[] {
  return interceptedMessages.filter(msg => msg.type === 'outgoing');
}

/**
 * Outgoing API call interceptor
 * Intercepts calls to bot.telegram.callApi
 */
export function outgoingInterceptor(originalCallApi: Function): Function {
  return async function(this: any, method: string, ...params: any[]) {
    const startTime = Date.now();
    
    try {
      // Call the original API method
      const response = await originalCallApi.call(this, method, ...params);
      
      // Record the successful call
      const interceptedCall: InterceptedCall = {
        method,
        params,
        timestamp: startTime,
        response,
      };
      interceptedCalls.push(interceptedCall);
      
      // Record as outgoing message if it's a message-sending method
      if (['sendMessage', 'editMessageText', 'deleteMessage'].includes(method)) {
        interceptedMessages.push({
          type: 'outgoing',
          method,
          payload: { method, params: params[0] }, // First param is usually the payload
          timestamp: startTime,
        });
      }
      
      return response;
    } catch (error) {
      // Record the failed call
      const interceptedCall: InterceptedCall = {
        method,
        params,
        timestamp: startTime,
        error,
      };
      interceptedCalls.push(interceptedCall);
      
      throw error;
    }
  };
}

/**
 * Incoming message interceptor middleware
 * Captures incoming messages before they reach command handlers
 */
export function incomingInterceptor(): Middleware<BotContext> {
  return async (ctx, next) => {
    // Record incoming message
    interceptedMessages.push({
      type: 'incoming',
      payload: ctx.message || ctx.callbackQuery,
      timestamp: Date.now(),
      context: {
        from: ctx.from,
        chat: ctx.chat,
        session: ctx.session,
      },
    });
    
    // Continue to next middleware
    await next();
  };
}

/**
 * Enhanced context interceptor
 * Wraps context methods to capture their usage
 */
export function enhanceContextForInterception(ctx: BotContext): BotContext {
  const originalReply = ctx.reply.bind(ctx);
  const originalEditMessageText = ctx.editMessageText?.bind(ctx);
  const originalDeleteMessage = ctx.deleteMessage?.bind(ctx);
  
  // Wrap reply method
  ctx.reply = async function(text: string, extra?: any) {
    const result = await originalReply(text, extra);
    
    // Record the reply
    interceptedMessages.push({
      type: 'outgoing',
      method: 'reply',
      payload: { text, extra },
      timestamp: Date.now(),
      context: {
        from: ctx.from,
        chat: ctx.chat,
      },
    });
    
    return result;
  };
  
  // Wrap editMessageText if it exists
  if (originalEditMessageText) {
    ctx.editMessageText = async function(text: string, extra?: any) {
      const result = await originalEditMessageText(text, extra);
      
      interceptedMessages.push({
        type: 'outgoing',
        method: 'editMessageText',
        payload: { text, extra },
        timestamp: Date.now(),
      });
      
      return result;
    };
  }
  
  // Wrap deleteMessage if it exists
  if (originalDeleteMessage) {
    ctx.deleteMessage = async function(messageId?: number) {
      const result = await originalDeleteMessage(messageId);
      
      interceptedMessages.push({
        type: 'outgoing',
        method: 'deleteMessage',
        payload: { messageId },
        timestamp: Date.now(),
      });
      
      return result;
    };
  }
  
  return ctx;
}

/**
 * Set up interceptors on a Telegraf bot instance
 */
export function setupInterceptors(bot: Telegraf<BotContext>): void {
  // Clear any existing intercepted data
  clearInterceptedData();
  
  // Intercept outgoing API calls
  const originalCallApi = bot.telegram.callApi.bind(bot.telegram);
  const newCallApi = outgoingInterceptor(originalCallApi);
  bot.telegram.callApi = newCallApi.bind(bot.telegram);
  
  // Add incoming message interceptor middleware
  bot.use(incomingInterceptor());
}

/**
 * Simulate a user message for testing
 */
export async function simulateUserMessage(
  bot: Telegraf<BotContext>,
  message: string,
  userOverrides: Partial<any> = {}
): Promise<void> {
  const mockUser = {
    id: 12345,
    is_bot: false,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    ...userOverrides,
  };
  
  const mockMessage = {
    message_id: Math.floor(Math.random() * 1000000),
    from: mockUser,
    chat: { 
      id: mockUser.id, 
      type: 'private' as const,
      first_name: mockUser.first_name,
      last_name: mockUser.last_name,
      username: mockUser.username,
    },
    date: Math.floor(Date.now() / 1000),
    text: message,
  };
  
  const mockUpdate = {
    update_id: Math.floor(Math.random() * 1000000),
    message: mockMessage,
  };
  
  // Process the update through the bot
  await bot.handleUpdate(mockUpdate);
}

/**
 * Utility functions for test assertions
 */
export const assertions = {
  /**
   * Assert that a specific API method was called
   */
  assertApiMethodCalled(method: string, times?: number): void {
    const calls = interceptedCalls.filter(call => call.method === method);
    
    if (times !== undefined) {
      if (calls.length !== times) {
        throw new Error(`Expected ${method} to be called ${times} times, but was called ${calls.length} times`);
      }
    } else {
      if (calls.length === 0) {
        throw new Error(`Expected ${method} to be called, but it was not called`);
      }
    }
  },
  
  /**
   * Assert that a message was sent with specific content
   */
  assertMessageSent(expectedText: string | RegExp): void {
    const sentMessages = getOutgoingMessages();
    const found = sentMessages.some(msg => {
      const text = msg.payload?.text || '';
      return typeof expectedText === 'string' 
        ? text.includes(expectedText)
        : expectedText.test(text);
    });
    
    if (!found) {
      throw new Error(`Expected message containing "${expectedText}" to be sent`);
    }
  },
  
  /**
   * Assert that a specific number of messages were sent
   */
  assertMessageCount(expectedCount: number): void {
    const sentMessages = getOutgoingMessages();
    if (sentMessages.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} messages to be sent, but ${sentMessages.length} were sent`);
    }
  },
  
  /**
   * Get the actual Telegram API payload for inspection
   */
  getActualPayload(method: string): any {
    const call = getLastCallOfMethod(method);
    return call?.params[0] || null;
  },
};