import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { User } from '../types/index.js';

/**
 * Supabase client instance
 */
export const supabase: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
    
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection test error:', error);
    return false;
  }
}

/**
 * Get or create user in database
 */
export async function getOrCreateUser(telegramUser: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}): Promise<User | null> {
  try {
    // First try to get existing user
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramUser.id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      logger.error('Error fetching user:', selectError);
      return null;
    }

    if (existingUser) {
      // Update user info if needed
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          updated_at: new Date().toISOString(),
        })
        .eq('telegram_id', telegramUser.id)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating user:', updateError);
        return existingUser;
      }

      return updatedUser;
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Error creating user:', insertError);
      return null;
    }

    logger.info(`Created new user: ${telegramUser.username || telegramUser.id}`);
    return newUser;
  } catch (error) {
    logger.error('Unexpected error in getOrCreateUser:', error);
    return null;
  }
}