#!/bin/bash

# Cabal.Ventures Bot - Manual Testing Runner
# This script helps you test the bot with your real .env credentials

set -e

echo "🚀 Cabal.Ventures Bot - Manual Testing"
echo "======================================"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Make sure your .env file with real API keys is in the project root."
    exit 1
fi

echo "✅ Found .env file"

# Verify required environment variables
echo "🔍 Checking environment variables..."

required_vars=("BOT_TOKEN" "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "REDIS_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env; then
        missing_vars+=("$var")
    else
        echo "✅ $var is set"
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

echo ""
echo "🔨 Building project..."
pnpm build

echo ""
echo "🎯 Ready for manual testing!"
echo ""
echo "NEXT STEPS:"
echo "1. Start the bot: pnpm start"
echo "2. Open Telegram and find your bot"
echo "3. Follow the manual testing guide in MANUAL_TESTING_GUIDE.md"
echo ""
echo "KEY TESTS TO DO:"
echo "📱 Send /start - Check welcome message"
echo "🔄 Send /test - Verify system status"
echo "🚦 Send 35+ messages quickly - Test rate limiting"
echo "🛡️ Send /invalidcommand - Test error handling"
echo ""
echo "Would you like to start the bot now? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting Cabal.Ventures Bot..."
    echo "Press Ctrl+C to stop"
    echo ""
    pnpm start
else
    echo ""
    echo "✅ Ready to test! Run 'pnpm start' when you're ready."
    echo "📖 See MANUAL_TESTING_GUIDE.md for detailed testing steps."
fi