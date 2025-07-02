import type { BotContext } from '../src/types/index.js';

declare global {
  function createMockTelegramUser(overrides?: any): any;
  function createMockSupabaseUser(overrides?: any): any;
  function createMockBotContext(overrides?: any): BotContext;
}

export {};