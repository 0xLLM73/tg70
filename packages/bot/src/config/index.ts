import dotenv from 'dotenv';
import { z } from 'zod';
import type { EnvConfig } from '../types/index.js';

// Load environment variables
dotenv.config();

/**
 * Environment variables validation schema
 */
const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default('development'),
  WEBHOOK_URL: z.string().url().optional(),
});

/**
 * Validate and export environment configuration
 */
function loadConfig(): EnvConfig {
  try {
    const config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export const config = loadConfig();

/**
 * Log configuration status (without exposing secrets)
 */
export function logConfigStatus(): void {
  console.log('✅ Configuration loaded successfully');
  console.log(`   - Environment: ${config.NODE_ENV}`);
  console.log(`   - Port: ${config.PORT}`);
  console.log(`   - Redis URL: ${config.REDIS_URL.replace(/\/\/.*@/, '//***@')}`);
  console.log(`   - Supabase URL: ${config.SUPABASE_URL}`);
  console.log(`   - Bot Token: ${config.BOT_TOKEN.substring(0, 10)}...`);
}