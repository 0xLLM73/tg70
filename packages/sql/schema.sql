-- Cabal.Ventures Telegram Bot Database Schema
-- This schema defines the core tables needed for the bot functionality

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(32),
    first_name VARCHAR(64),
    last_name VARCHAR(64),
    is_bot BOOLEAN DEFAULT FALSE,
    language_code VARCHAR(10),
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'Telegram users who have interacted with the bot';
COMMENT ON COLUMN users.telegram_id IS 'Unique Telegram user ID';
COMMENT ON COLUMN users.username IS 'Telegram username (without @)';
COMMENT ON COLUMN users.first_name IS 'User first name from Telegram';
COMMENT ON COLUMN users.last_name IS 'User last name from Telegram';
COMMENT ON COLUMN users.is_bot IS 'Whether this user is a bot';
COMMENT ON COLUMN users.language_code IS 'User language code from Telegram';
COMMENT ON COLUMN users.is_premium IS 'Whether user has Telegram Premium';
COMMENT ON COLUMN users.created_at IS 'When user first interacted with bot';
COMMENT ON COLUMN users.updated_at IS 'When user record was last updated';