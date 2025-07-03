/**
 * DEMO: Mock vs Interceptor Testing Comparison
 * 
 * This script demonstrates the key differences between our current mock-based
 * testing approach and the new interceptor-based approach.
 * 
 * Run with: npx tsx src/__tests__/interceptor/mock-vs-interceptor-demo.ts
 */

/// <reference types="jest" />

import { Telegraf } from 'telegraf';
import { createBot } from '../../bot.js';
import {
  setupInterceptors,
  simulateUserMessage,
  getInterceptedCalls,
  getOutgoingMessages,
  clearInterceptedData,
  assertions,
} from '../interceptors.js';
import type { BotContext } from '../../types/index.js';

// Mock the services for this demo
import '../interceptor-setup.js';

async function runMockApproachDemo() {
  console.log('\n' + '🎭 MOCK-BASED APPROACH'.padEnd(50, '='));
  console.log('This is how our current tests work...\n');
  
  // Simulate current mock approach
  const mockContext = {
    from: { id: 12345, username: 'mock_user', first_name: 'Mock' },
    reply: jest.fn().mockResolvedValue({ message_id: 123 }),
    session: {
      userId: 12345,
      lastActivity: new Date(),
      user: {
        id: 'mock-user-id',
        telegram_id: 12345,
        email: 'mock@example.com',
        username: 'mock_user',
        first_name: 'Mock',
        role: 'user' as const,
      },
    },
  };
  
  // Import and call the test command directly
  const { testCommand } = await import('../../commands/test.js');
  await testCommand(mockContext as any);
  
  console.log('✅ Mock test executed');
  console.log('📊 What we can verify with mocks:');
  console.log('   • Function was called:', mockContext.reply.mock.calls.length > 0);
  console.log('   • Message contains expected text:', 
    mockContext.reply.mock.calls[0]?.[0]?.includes('🧪 **Cabal.Ventures Bot Test Results**'));
  
  console.log('\n❌ What mocks CANNOT tell us:');
  console.log('   • Actual Telegram API payload structure');
  console.log('   • Real message formatting compliance');
  console.log('   • Actual API method called');
  console.log('   • Integration with Telegraf framework');
  console.log('   • Performance characteristics');
  
  return {
    approach: 'mock',
    callCount: mockContext.reply.mock.calls.length,
    messageText: mockContext.reply.mock.calls[0]?.[0] || '',
    canInspectPayload: false,
    canValidateApiCompliance: false,
  };
}

async function runInterceptorApproachDemo() {
  console.log('\n' + '🔍 INTERCEPTOR-BASED APPROACH'.padEnd(50, '='));
  console.log('This is what we can do with interceptors...\n');
  
  // Create real bot with interceptors
  const bot = createBot();
  setupInterceptors(bot);
  
  // Simulate real user interaction
  await simulateUserMessage(bot, '/test', {
    id: 67890,
    username: 'interceptor_user',
    first_name: 'Interceptor',
  });
  
  // Get intercepted data
  const interceptedCalls = getInterceptedCalls();
  const outgoingMessages = getOutgoingMessages();
  const actualPayload = assertions.getActualPayload('sendMessage');
  
  console.log('✅ Interceptor test executed');
  console.log('📊 What interceptors can verify:');
  console.log('   • Actual API method called:', interceptedCalls[0]?.method);
  console.log('   • Real payload structure keys:', Object.keys(actualPayload));
  console.log('   • Message length:', actualPayload.text.length, 'chars');
  console.log('   • Parse mode setting:', actualPayload.parse_mode);
  console.log('   • Chat ID type:', typeof actualPayload.chat_id);
  console.log('   • Full integration flow: ✅');
  
  console.log('\n🎯 Additional interceptor benefits:');
  console.log('   • Real API call timing:', new Date(interceptedCalls[0]?.timestamp).toLocaleTimeString());
  console.log('   • Can record/replay sessions');
  console.log('   • Validates Telegram API compliance');
  console.log('   • Catches formatting issues before production');
  
  return {
    approach: 'interceptor',
    callCount: interceptedCalls.length,
    messageText: actualPayload.text,
    canInspectPayload: true,
    canValidateApiCompliance: true,
    actualPayload,
    apiMethod: interceptedCalls[0]?.method,
    timing: interceptedCalls[0]?.timestamp,
  };
}

async function compareApproaches() {
  console.log('\n' + '📊 SIDE-BY-SIDE COMPARISON'.padEnd(50, '='));
  
  const mockResults = await runMockApproachDemo();
  const interceptorResults = await runInterceptorApproachDemo();
  
  console.log('\n📈 COMPARISON SUMMARY:');
  console.log('┌─────────────────────────┬─────────────┬─────────────────┐');
  console.log('│ Feature                 │ Mock        │ Interceptor     │');
  console.log('├─────────────────────────┼─────────────┼─────────────────┤');
  console.log('│ Execution Speed         │ ⚡ Fast     │ 🐌 Slower       │');
  console.log('│ API Payload Inspection  │ ❌ No       │ ✅ Yes          │');
  console.log('│ Real API Validation     │ ❌ No       │ ✅ Yes          │');
  console.log('│ Integration Testing     │ ❌ No       │ ✅ Yes          │');
  console.log('│ Formatting Validation   │ ❌ No       │ ✅ Yes          │');
  console.log('│ Performance Metrics     │ ❌ No       │ ✅ Yes          │');
  console.log('│ Session Recording       │ ❌ No       │ ✅ Yes          │');
  console.log('│ Setup Complexity        │ ✅ Simple   │ ⚠️ Moderate     │');
  console.log('│ Debugging Ease          │ ✅ Easy     │ ⚠️ Moderate     │');
  console.log('│ External Dependencies   │ ✅ None     │ ⚠️ Some         │');
  console.log('└─────────────────────────┴─────────────┴─────────────────┘');
  
  console.log('\n🎯 KEY INSIGHTS:');
  console.log('• Both approaches verify the core functionality works');
  console.log('• Interceptors provide significantly more confidence about production behavior');
  console.log('• Mocks are faster and simpler for unit testing');
  console.log('• Interceptors catch integration issues mocks cannot detect');
  
  console.log('\n💡 RECOMMENDED STRATEGY:');
  console.log('• Keep mock-based tests for fast unit testing');
  console.log('• Add interceptor-based tests for critical integration flows');
  console.log('• Use interceptors for debugging production issues');
  console.log('• Implement hybrid approach for best of both worlds');
  
  return { mockResults, interceptorResults };
}

async function demonstrateRealWorldBenefits() {
  console.log('\n' + '🚨 REAL-WORLD ISSUES INTERCEPTORS CAN CATCH'.padEnd(50, '='));
  
  const bot = createBot();
  setupInterceptors(bot);
  
  await simulateUserMessage(bot, '/test');
  const actualPayload = assertions.getActualPayload('sendMessage');
  
  console.log('\n🔍 Real API validation that mocks miss:');
  
  // Check message length compliance
  const messageLength = actualPayload.text.length;
  const telegramLimit = 4096;
  console.log(`📏 Message length: ${messageLength}/${telegramLimit} characters`);
  if (messageLength > telegramLimit) {
    console.log('🚨 ISSUE: Message exceeds Telegram limit! This would fail in production.');
  } else {
    console.log('✅ Message length compliant with Telegram API');
  }
  
  // Check Markdown formatting
  const boldMarkers = (actualPayload.text.match(/\*\*/g) || []).length;
  console.log(`🎨 Markdown bold markers: ${boldMarkers} (should be even)`);
  if (boldMarkers % 2 !== 0) {
    console.log('🚨 ISSUE: Unmatched bold markers! This would break formatting in production.');
  } else {
    console.log('✅ Markdown formatting is valid');
  }
  
  // Check required fields
  const requiredFields = ['chat_id', 'text'];
  const missingFields = requiredFields.filter(field => !(field in actualPayload));
  if (missingFields.length > 0) {
    console.log(`🚨 ISSUE: Missing required fields: ${missingFields.join(', ')}`);
  } else {
    console.log('✅ All required Telegram API fields present');
  }
  
  console.log('\n📊 Actual payload structure:');
  console.log(JSON.stringify(actualPayload, null, 2));
}

// Main execution
async function main() {
  console.log('🎬 MOCK vs INTERCEPTOR TESTING DEMONSTRATION');
  console.log('='.repeat(60));
  
  try {
    await compareApproaches();
    await demonstrateRealWorldBenefits();
    
    console.log('\n✅ Demo completed successfully!');
    console.log('\n🚀 Next steps:');
    console.log('• Run the interceptor tests: npm run test:interceptor');
    console.log('• Compare with existing tests: npm test');
    console.log('• Review the interceptor implementation in __tests__/interceptors.ts');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { compareApproaches, demonstrateRealWorldBenefits };