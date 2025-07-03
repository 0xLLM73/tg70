import express, { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from root directory for local development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../../.env' });
}

// Environment validation
const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  NODE_ENV: z.string().default('development'),
});

const env = envSchema.parse(process.env);

// Supabase clients
const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for development
if (env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'cabal-ventures-verification',
    version: '1.0.0',
  });
});

// Magic link verification endpoint
app.get('/verify', async (req: Request, res: Response) => {
  try {
    const { access_token, refresh_token, telegram_id, username, first_name } = req.query;

    if (!access_token) {
      return res.status(400).send(createErrorPage(
        'Missing Access Token',
        'The magic link is missing required authentication data.',
        'Please request a new magic link from the Telegram bot.'
      ));
    }

    if (!telegram_id) {
      return res.status(400).send(createErrorPage(
        'Missing Telegram Data',
        'The magic link is missing Telegram user information.',
        'Please request a new magic link from the Telegram bot.'
      ));
    }

    // Verify the access token with Supabase
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(access_token as string);

    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return res.status(401).send(createErrorPage(
        'Invalid or Expired Link',
        'The magic link has expired or is invalid.',
        'Please request a new magic link from the Telegram bot.'
      ));
    }

    if (!user.email) {
      return res.status(400).send(createErrorPage(
        'No Email Found',
        'User account does not have an email address.',
        'Please contact support for assistance.'
      ));
    }

    // Link the Telegram user
    const linkResult = await linkTelegramUser(
      user.id,
      parseInt(telegram_id as string),
      user.email,
      {
        username: username as string,
        first_name: first_name as string,
      }
    );

    if (!linkResult.success) {
      console.error('Linking failed:', linkResult.error);
      return res.status(400).send(createErrorPage(
        'Linking Failed',
        linkResult.error || 'Failed to link your Telegram account.',
        'Please try again or contact support if the problem persists.'
      ));
    }

    // Success! Show confirmation page
    res.send(createSuccessPage(
      user.email,
      username as string || 'User',
      linkResult.data?.role || 'user'
    ));

  } catch (error) {
    console.error('Verification endpoint error:', error);
    res.status(500).send(createErrorPage(
      'Server Error',
      'An unexpected error occurred during verification.',
      'Please try again later or contact support.'
    ));
  }
});

// POST endpoint for programmatic linking (used by other services)
app.post('/linkTelegram', async (req: Request, res: Response) => {
  try {
    const { access_token, telegram_id, username, first_name } = req.body;

    if (!access_token || !telegram_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: access_token, telegram_id',
      });
    }

    // Verify the access token
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(access_token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired access token',
      });
    }

    // Link the user
    const linkResult = await linkTelegramUser(
      user.id,
      telegram_id,
      user.email!,
      { username, first_name }
    );

    res.json(linkResult);
  } catch (error) {
    console.error('Link Telegram API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Link Telegram user to Supabase user account
 */
async function linkTelegramUser(
  supabaseUserId: string,
  telegramId: number,
  email: string,
  metadata?: {
    username?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // Check if telegram_id is already linked to another account
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing Telegram link:', checkError);
      return {
        success: false,
        error: 'Failed to check existing links',
      };
    }

    if (existingUser && existingUser.id !== supabaseUserId) {
      return {
        success: false,
        error: 'This Telegram account is already linked to another email address',
      };
    }

    // Update or create user record with telegram_id
    const { data: user, error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: supabaseUserId,
        telegram_id: telegramId,
        email,
        username: metadata?.username,
        first_name: metadata?.first_name,
        last_name: metadata?.last_name,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error linking Telegram user:', upsertError);
      
      // Handle unique constraint violation
      if (upsertError.code === '23505') {
        return {
          success: false,
          error: 'This Telegram account is already linked to another email address',
        };
      }
      
      return {
        success: false,
        error: 'Failed to link Telegram account',
      };
    }

    // Log auth event
    await logAuthEvent({
      user_id: supabaseUserId,
      telegram_id: telegramId,
      event: 'link',
      metadata: {
        email,
        username: metadata?.username,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`Successfully linked Telegram ${telegramId} to user ${supabaseUserId}`);
    return {
      success: true,
      data: user,
    };
  } catch (error) {
    console.error('Error in linkTelegramUser:', error);
    return {
      success: false,
      error: 'Failed to link Telegram account',
    };
  }
}

/**
 * Log authentication/authorization events for audit
 */
async function logAuthEvent(event: {
  user_id: string;
  telegram_id?: number;
  event: string;
  ip?: string;
  user_agent?: string;
  metadata?: any;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin
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
      console.error('Failed to log auth event:', error);
    }
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
}

/**
 * Create success page HTML
 */
function createSuccessPage(email: string, username: string, role: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Linked Successfully - Cabal.Ventures</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            color: #4a5568;
            margin-bottom: 30px;
            font-size: 18px;
        }
        .info-box {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .info-item {
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .info-label {
            font-weight: 600;
            color: #4a5568;
        }
        .info-value {
            color: #2d3748;
            font-family: monospace;
        }
        .next-steps {
            background: #ebf8ff;
            border: 1px solid #bee3f8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .cta-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin-top: 20px;
            transition: background 0.2s;
        }
        .cta-button:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Account Linked Successfully!</h1>
        <p class="subtitle">Your Telegram account has been connected to Cabal.Ventures</p>
        
        <div class="info-box">
            <div class="info-item">
                <span class="info-label">📧 Email:</span>
                <span class="info-value">${maskEmail(email)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">👤 Username:</span>
                <span class="info-value">@${username}</span>
            </div>
            <div class="info-item">
                <span class="info-label">🔰 Role:</span>
                <span class="info-value">${role}</span>
            </div>
        </div>

        <div class="next-steps">
            <h3>🚀 What's Next?</h3>
            <ol>
                <li>Return to the Telegram bot</li>
                <li>Send any message to confirm your account is linked</li>
                <li>Use <code>/link_status</code> to verify your status</li>
                <li>Explore available commands with <code>/help</code></li>
            </ol>
        </div>

        <p>You can safely close this page and return to Telegram.</p>
    </div>
</body>
</html>`;
}

/**
 * Create error page HTML
 */
function createErrorPage(title: string, message: string, suggestion: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Cabal.Ventures</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px 20px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .message {
            color: #4a5568;
            margin-bottom: 20px;
            font-size: 16px;
        }
        .suggestion {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            color: #742a2a;
        }
        .suggestion strong {
            color: #c53030;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>${title}</h1>
        <p class="message">${message}</p>
        <div class="suggestion">
            <strong>What to do next:</strong><br>
            ${suggestion}
        </div>
    </div>
</body>
</html>`;
}

/**
 * Mask email for display
 */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***';
  }
  
  const [local, domain] = email.split('@');
  
  if (local.length <= 1) {
    return `${local}***@${domain.charAt(0)}***`;
  }
  
  const maskedLocal = local.charAt(0) + '*'.repeat(Math.min(local.length - 1, 3));
  const maskedDomain = domain.charAt(0) + '*'.repeat(Math.min(domain.length - 1, 3));
  
  return `${maskedLocal}@${maskedDomain}`;
}

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Verification server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Verify endpoint: http://localhost:${PORT}/verify`);
  console.log(`🔧 Environment: ${env.NODE_ENV}`);
});