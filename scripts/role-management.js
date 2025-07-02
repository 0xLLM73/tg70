#!/usr/bin/env node

/**
 * CLI Role Management Tools for Cabal.Ventures Bot
 * Usage:
 *   node scripts/role-management.js set <user_id> <role>
 *   node scripts/role-management.js list [role]
 *   node scripts/role-management.js audit [limit]
 *   node scripts/role-management.js find <telegram_id>
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

// Validate required environment variables
const requiredEnvs = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvs.forEach(env => console.error(`   - ${env}`));
  console.error('\nMake sure your .env file is properly configured.');
  process.exit(1);
}

// Initialize Supabase admin client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const VALID_ROLES = ['siteAdmin', 'communityAdmin', 'user'];

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case 'set':
        await setUserRole(args[1], args[2]);
        break;
      case 'list':
        await listUsers(args[1]);
        break;
      case 'audit':
        await showAuditLog(parseInt(args[1]) || 50);
        break;
      case 'find':
        await findUser(args[1]);
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Set user role
 */
async function setUserRole(userId, role) {
  if (!userId || !role) {
    console.error('❌ Usage: node scripts/role-management.js set <user_id> <role>');
    console.error('   Roles: siteAdmin, communityAdmin, user');
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ Invalid role: ${role}`);
    console.error(`   Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  console.log(`🔧 Setting user ${userId} role to ${role}...`);

  // Get current user data
  const { data: currentUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      console.error(`❌ User not found: ${userId}`);
    } else {
      console.error('❌ Error fetching user:', fetchError.message);
    }
    process.exit(1);
  }

  // Update user role
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ 
      role,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error updating user role:', updateError.message);
    process.exit(1);
  }

  // Log the role change
  await logAuthEvent({
    user_id: userId,
    telegram_id: currentUser.telegram_id,
    event: 'role_change',
    metadata: {
      old_role: currentUser.role,
      new_role: role,
      changed_by: 'cli_tool',
      timestamp: new Date().toISOString(),
    },
  });

  console.log('✅ Role updated successfully!');
  console.log(`📊 User Details:`);
  console.log(`   ID: ${updatedUser.id}`);
  console.log(`   Email: ${updatedUser.email || 'Not set'}`);
  console.log(`   Telegram ID: ${updatedUser.telegram_id || 'Not linked'}`);
  console.log(`   Username: ${updatedUser.username || 'Not set'}`);
  console.log(`   Previous Role: ${currentUser.role}`);
  console.log(`   New Role: ${updatedUser.role}`);
}

/**
 * List users with optional role filter
 */
async function listUsers(roleFilter) {
  console.log('👥 Loading users...\n');

  let query = supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (roleFilter) {
    if (!VALID_ROLES.includes(roleFilter)) {
      console.error(`❌ Invalid role filter: ${roleFilter}`);
      console.error(`   Valid roles: ${VALID_ROLES.join(', ')}`);
      process.exit(1);
    }
    query = query.eq('role', roleFilter);
  }

  const { data: users, error } = await query;

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  if (users.length === 0) {
    console.log('📭 No users found.');
    return;
  }

  console.log(`📋 Found ${users.length} user(s)${roleFilter ? ` with role '${roleFilter}'` : ''}:\n`);

  // Group users by role for better display
  const usersByRole = users.reduce((acc, user) => {
    acc[user.role] = acc[user.role] || [];
    acc[user.role].push(user);
    return acc;
  }, {});

  // Display users grouped by role
  Object.entries(usersByRole).forEach(([role, roleUsers]) => {
    console.log(`🔰 ${getRoleDisplayName(role)} (${roleUsers.length})`);
    console.log('─'.repeat(50));
    
    roleUsers.forEach(user => {
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email || '❌ Not set'}`);
      console.log(`   Telegram: ${user.telegram_id ? `✅ ${user.telegram_id}` : '❌ Not linked'}`);
      console.log(`   Username: ${user.username ? `@${user.username}` : '❌ Not set'}`);
      console.log(`   Name: ${user.first_name || 'Not set'}${user.last_name ? ` ${user.last_name}` : ''}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`   Last Login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}`);
      console.log('');
    });
  });

  // Summary
  console.log('📊 Summary:');
  VALID_ROLES.forEach(role => {
    const count = usersByRole[role]?.length || 0;
    console.log(`   ${getRoleDisplayName(role)}: ${count}`);
  });
}

/**
 * Show audit log
 */
async function showAuditLog(limit = 50) {
  console.log(`📋 Loading last ${limit} audit events...\n`);

  const { data: events, error } = await supabase
    .from('auth_events')
    .select(`
      *,
      users (
        email,
        username,
        first_name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching audit events:', error.message);
    process.exit(1);
  }

  if (events.length === 0) {
    console.log('📭 No audit events found.');
    return;
  }

  console.log(`📋 Audit Log (${events.length} events):\n`);

  events.forEach(event => {
    const timestamp = new Date(event.created_at).toLocaleString();
    const user = event.users?.[0];
    const userInfo = user ? `${user.email || 'No email'} (@${user.username || 'no-username'})` : 'Unknown user';
    
    console.log(`🕐 ${timestamp}`);
    console.log(`📝 Event: ${getEventDisplayName(event.event)}`);
    console.log(`👤 User: ${userInfo}`);
    console.log(`🆔 User ID: ${event.user_id}`);
    
    if (event.telegram_id) {
      console.log(`📱 Telegram: ${event.telegram_id}`);
    }
    
    if (event.metadata) {
      console.log(`📊 Details: ${JSON.stringify(event.metadata, null, 2)}`);
    }
    
    console.log('─'.repeat(60));
  });
}

/**
 * Find user by telegram ID or user ID
 */
async function findUser(identifier) {
  if (!identifier) {
    console.error('❌ Usage: node scripts/role-management.js find <telegram_id|user_id>');
    process.exit(1);
  }

  console.log(`🔍 Searching for user: ${identifier}...\n`);

  // Try to find by telegram_id first (if it's a number)
  let user = null;
  let searchType = '';

  if (/^\d+$/.test(identifier)) {
    // Search by telegram_id
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', parseInt(identifier))
      .single();
    
    if (!error && data) {
      user = data;
      searchType = 'Telegram ID';
    }
  }

  // If not found, try by user_id (UUID)
  if (!user) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', identifier)
      .single();
    
    if (!error && data) {
      user = data;
      searchType = 'User ID';
    }
  }

  if (!user) {
    console.log('❌ User not found.');
    console.log('💡 Try searching by:');
    console.log('   - Telegram ID (numbers only)');
    console.log('   - User ID (UUID format)');
    return;
  }

  console.log(`✅ User found (by ${searchType}):\n`);
  console.log(`🆔 User ID: ${user.id}`);
  console.log(`📧 Email: ${user.email || '❌ Not set'}`);
  console.log(`📱 Telegram ID: ${user.telegram_id || '❌ Not linked'}`);
  console.log(`👤 Username: ${user.username ? `@${user.username}` : '❌ Not set'}`);
  console.log(`🏷️ Name: ${user.first_name || 'Not set'}${user.last_name ? ` ${user.last_name}` : ''}`);
  console.log(`🔰 Role: ${getRoleDisplayName(user.role)}`);
  console.log(`📅 Created: ${new Date(user.created_at).toLocaleString()}`);
  console.log(`🕐 Last Login: ${user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}`);
  console.log(`🔄 Updated: ${new Date(user.updated_at).toLocaleString()}`);

  // Show recent audit events for this user
  const { data: recentEvents } = await supabase
    .from('auth_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentEvents && recentEvents.length > 0) {
    console.log(`\n📋 Recent Activity (${recentEvents.length} events):`);
    recentEvents.forEach(event => {
      console.log(`   ${new Date(event.created_at).toLocaleDateString()} - ${getEventDisplayName(event.event)}`);
    });
  }
}

/**
 * Log authentication event
 */
async function logAuthEvent(event) {
  try {
    const { error } = await supabase
      .from('auth_events')
      .insert({
        user_id: event.user_id,
        telegram_id: event.telegram_id,
        event: event.event,
        ip: event.ip,
        user_agent: event.user_agent,
        metadata: event.metadata,
      });

    if (error) {
      console.warn('⚠️ Failed to log audit event:', error.message);
    }
  } catch (error) {
    console.warn('⚠️ Error logging audit event:', error.message);
  }
}

/**
 * Get display name for role
 */
function getRoleDisplayName(role) {
  const roleNames = {
    siteAdmin: '🔱 Site Administrator',
    communityAdmin: '⚡ Community Administrator',
    user: '👤 User',
  };
  return roleNames[role] || role;
}

/**
 * Get display name for event
 */
function getEventDisplayName(event) {
  const eventNames = {
    login: '🚪 Login',
    link: '🔗 Account Linked',
    unlink: '🔓 Account Unlinked',
    role_change: '🔄 Role Changed',
  };
  return eventNames[event] || event;
}

/**
 * Show help information
 */
function showHelp() {
  console.log('🔧 Cabal.Ventures Role Management CLI\n');
  console.log('Usage:');
  console.log('  node scripts/role-management.js <command> [options]\n');
  console.log('Commands:');
  console.log('  set <user_id> <role>    Set user role (siteAdmin, communityAdmin, user)');
  console.log('  list [role]             List all users, optionally filtered by role');
  console.log('  audit [limit]           Show audit log (default: 50 events)');
  console.log('  find <id>               Find user by Telegram ID or User ID');
  console.log('  help                    Show this help message\n');
  console.log('Examples:');
  console.log('  node scripts/role-management.js set 550e8400-e29b-41d4-a716-446655440000 siteAdmin');
  console.log('  node scripts/role-management.js list siteAdmin');
  console.log('  node scripts/role-management.js audit 100');
  console.log('  node scripts/role-management.js find 123456789');
  console.log('');
  console.log('Environment variables required:');
  console.log('  SUPABASE_URL                 - Your Supabase project URL');
  console.log('  SUPABASE_SERVICE_ROLE_KEY    - Service role key (bypasses RLS)');
}

// Run the CLI
main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});