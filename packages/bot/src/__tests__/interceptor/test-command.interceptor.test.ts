/**
 * PROOF OF CONCEPT: Interceptor-Based Testing for /test Command
 * 
 * This test demonstrates the Singapore GDS interceptor approach vs our current mock approach.
 * 
 * Run this test with: npx jest test-command.interceptor.test.ts
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
  getOutgoingMessages,
  clearInterceptedData,
  assertions,
} from '../interceptors.js';
import type { BotContext } from '../../types/index.js';

// Use interceptor setup instead of regular setup
import '../interceptor-setup.js';

describe('PROOF OF CONCEPT: Interceptor vs Mock Testing', () => {
  let bot: Telegraf<BotContext>;
  
  beforeEach(() => {
    // Create a fresh bot instance for each test
    bot = createBot();
    
    // Set up interceptors on the bot
    setupInterceptors(bot);
  });
  
  afterEach(() => {
    clearInterceptedData();
  });

  describe('🔬 Interceptor Approach - /test Command', () => {
    it('should capture real Telegram API payloads', async () => {
      // Simulate user sending /test command
      await simulateUserMessage(bot, '/test', {
        id: 123456,
        username: 'interceptor_user',
        first_name: 'Interceptor',
        last_name: 'Test',
      });
      
      // 🎯 KEY BENEFIT: We can inspect actual Telegram API calls
      const interceptedCalls = getInterceptedCalls();
      const outgoingMessages = getOutgoingMessages();
      
      // Verify API method was called
      assertions.assertApiMethodCalled('sendMessage');
      
      // 🔍 INSPECT REAL PAYLOADS - This is what we couldn't do with mocks!
      const actualPayload = assertions.getActualPayload('sendMessage');
      
      console.log('\n🎯 INTERCEPTED TELEGRAM API PAYLOAD:');
      console.log(JSON.stringify(actualPayload, null, 2));
      
      // Verify the actual structure matches Telegram API
      expect(actualPayload).toHaveProperty('chat_id');
      expect(actualPayload).toHaveProperty('text');
      expect(actualPayload).toHaveProperty('parse_mode', 'Markdown');
      
      // Verify message content
      expect(actualPayload.text).toContain('🧪 **Cabal.Ventures Bot Test Results**');
      expect(actualPayload.text).toContain('**System Status:**');
      expect(actualPayload.text).toContain('Database: ✅ Connected');
      expect(actualPayload.text).toContain('Redis: ✅ Connected');
      expect(actualPayload.text).toContain('**Rate Limiting:**');
      expect(actualPayload.text).toContain('**User Info:**');
      expect(actualPayload.text).toContain('ID: 123456');
      expect(actualPayload.text).toContain('Username: interceptor_user');
      
      // 🎯 BENEFIT: Validate actual message flow
      expect(outgoingMessages).toHaveLength(1);
      expect(outgoingMessages[0].payload.text).toContain('🎉 All systems operational!');
    });
    
    it('should validate message formatting meets Telegram requirements', async () => {
      await simulateUserMessage(bot, '/test');
      
      const actualPayload = assertions.getActualPayload('sendMessage');
      
      // 🎯 REAL API VALIDATION - These checks catch formatting issues mocks miss
      
      // Telegram message length limit (4096 characters)
      expect(actualPayload.text.length).toBeLessThanOrEqual(4096);
      
      // Markdown formatting validation
      expect(actualPayload.parse_mode).toBe('Markdown');
      
      // Chat ID must be a number
      expect(typeof actualPayload.chat_id).toBe('number');
      
      // Message structure matches Telegram API spec
      expect(actualPayload).toMatchObject({
        chat_id: expect.any(Number),
        text: expect.any(String),
        parse_mode: 'Markdown',
      });
      
      console.log('\n✅ Message passes Telegram API validation!');
    });
    
    it('should capture timing and performance metrics', async () => {
      const startTime = Date.now();
      
      await simulateUserMessage(bot, '/test');
      
      const interceptedCalls = getInterceptedCalls();
      const sendMessageCall = interceptedCalls.find(call => call.method === 'sendMessage');
      
      // 🎯 PERFORMANCE INSIGHTS - We can measure actual execution time
      expect(sendMessageCall).toBeDefined();
      expect(sendMessageCall!.timestamp).toBeGreaterThan(startTime);
      
      const executionTime = Date.now() - sendMessageCall!.timestamp;
      console.log(`\n⏱️  Command execution time: ${executionTime}ms`);
      
      // Ensure reasonable response time
      expect(executionTime).toBeLessThan(5000); // 5 seconds max
    });
    
    it('should capture error scenarios with real API responses', async () => {
      // Test with malformed user to trigger error path
      await simulateUserMessage(bot, '/test', {
        id: null, // This should trigger the error path
      });
      
      const outgoingMessages = getOutgoingMessages();
      
      // Should handle error gracefully and send error message
      expect(outgoingMessages.length).toBeGreaterThan(0);
      
      const errorMessage = outgoingMessages.find(msg => 
        msg.payload.text?.includes('❌ Unable to identify user')
      );
      
      expect(errorMessage).toBeDefined();
      console.log('\n🚨 Error handling captured:', errorMessage?.payload.text);
    });
  });

  describe('📊 COMPARISON: Mock vs Interceptor Results', () => {
    it('should demonstrate what interceptors catch that mocks miss', async () => {
      console.log('\n' + '='.repeat(60));
      console.log('📊 MOCK vs INTERCEPTOR COMPARISON');
      console.log('='.repeat(60));
      
      // Run the interceptor test
      await simulateUserMessage(bot, '/test', {
        id: 999999,
        username: 'comparison_user',
        first_name: 'Comparison',
      });
      
      const actualPayload = assertions.getActualPayload('sendMessage');
      const interceptedCalls = getInterceptedCalls();
      
      console.log('\n🔍 WHAT INTERCEPTORS CAPTURE (but mocks miss):');
      console.log('✅ Actual Telegram API method called:', interceptedCalls[0]?.method);
      console.log('✅ Real message payload structure:', Object.keys(actualPayload));
      console.log('✅ Actual chat_id type:', typeof actualPayload.chat_id);
      console.log('✅ Real message length:', actualPayload.text.length, 'characters');
      console.log('✅ Parse mode setting:', actualPayload.parse_mode);
      console.log('✅ Full API call timing:', interceptedCalls[0]?.timestamp);
      
      console.log('\n❌ WHAT MOCKS CANNOT VALIDATE:');
      console.log('❌ Real API payload structure');
      console.log('❌ Message formatting compliance');
      console.log('❌ Actual Telegram API method signatures');
      console.log('❌ Real response timing');
      console.log('❌ Integration between Telegraf and our code');
      
      console.log('\n🎯 INTERCEPTOR ADVANTAGES:');
      console.log('• Catches message formatting issues before production');
      console.log('• Validates actual API compliance');
      console.log('• Provides real performance metrics');
      console.log('• Tests true integration flow');
      console.log('• Can record/replay real user interactions');
      
      console.log('\n⚡ MOCK ADVANTAGES:');
      console.log('• Faster execution');
      console.log('• No external dependencies');
      console.log('• 100% predictable');
      console.log('• Easy debugging');
      console.log('• Simpler setup');
      
      // The test itself - both approaches should work
      expect(actualPayload.text).toContain('🧪 **Cabal.Ventures Bot Test Results**');
      expect(interceptedCalls.length).toBeGreaterThan(0);
    });
  });

  describe('🎯 Real-World Scenarios Interceptors Can Catch', () => {
    it('should detect Markdown formatting issues', async () => {
      // This test shows how interceptors catch real formatting problems
      await simulateUserMessage(bot, '/test');
      
      const actualPayload = assertions.getActualPayload('sendMessage');
      
      // Check for common Markdown issues that could break in production
      const text = actualPayload.text;
      
      // Ensure asterisks are properly paired for bold text
      const boldMarkers = (text.match(/\*\*/g) || []).length;
      expect(boldMarkers % 2).toBe(0); // Must be even number
      
      // Ensure no unescaped special characters that could break formatting
      expect(text).not.toMatch(/(?<!\\)[_`\[\]]/); // Unescaped markdown chars
      
      console.log('\n✅ Markdown formatting validation passed');
      console.log('   Bold markers (should be even):', boldMarkers);
    });
    
    it('should validate message doesn\'t exceed Telegram limits', async () => {
      await simulateUserMessage(bot, '/test');
      
      const actualPayload = assertions.getActualPayload('sendMessage');
      
      // Telegram API limits
      expect(actualPayload.text.length).toBeLessThanOrEqual(4096);
      expect(actualPayload.text.length).toBeGreaterThan(0);
      
      console.log('\n📏 Message length validation:');
      console.log('   Actual length:', actualPayload.text.length);
      console.log('   Telegram limit: 4096');
      console.log('   ✅ Within limits');
    });
  });

  describe('🚀 Future Possibilities with Interceptors', () => {
    it('should enable recording and replay of user interactions', async () => {
      // Simulate a user session
      await simulateUserMessage(bot, '/test', {
        id: 555555,
        username: 'replay_user',
      });
      
      const allMessages = getInterceptedMessages();
      const incoming = allMessages.filter(m => m.type === 'incoming');
      const outgoing = allMessages.filter(m => m.type === 'outgoing');
      
      console.log('\n🎬 SESSION RECORDING:');
      console.log('📥 Incoming messages:', incoming.length);
      console.log('📤 Outgoing messages:', outgoing.length);
      
      // This data could be saved and replayed for regression testing
      const sessionData = {
        incoming,
        outgoing,
        timestamp: Date.now(),
        userId: 555555,
      };
      
      expect(sessionData.incoming.length).toBe(1);
      expect(sessionData.outgoing.length).toBe(1);
      
      console.log('💾 Session data ready for replay testing');
    });
  });
});