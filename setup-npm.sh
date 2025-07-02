#!/bin/bash

# Cabal.Ventures Bot - NPM Setup Script
echo "🚀 Setting up Cabal.Ventures Bot with npm"
echo "========================================="

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Make sure your .env file with real API keys is in the project root."
    exit 1
fi

echo "✅ Found .env file"

# Option 1: Use npm workspaces (if npm version supports it)
echo ""
echo "🔧 Choose setup method:"
echo "1. Use npm workspaces (recommended for npm 7+)"
echo "2. Work directly with bot package (works with any npm version)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "📦 Setting up with npm workspaces..."
    
    # Replace package.json
    if [ -f "package-npm.json" ]; then
        cp package-npm.json package.json
        echo "✅ Updated package.json for npm workspaces"
    fi
    
    # Install dependencies
    npm install
    
    # Build
    npm run build
    
    echo ""
    echo "🚀 Ready! Start the bot with:"
    echo "npm start"
    
elif [ "$choice" = "2" ]; then
    echo ""
    echo "📦 Setting up bot package directly..."
    
    # Go to bot package
    cd packages/bot
    
    # Install dependencies
    npm install
    
    # Build
    npm run build
    
    echo ""
    echo "🚀 Ready! Start the bot with:"
    echo "cd packages/bot && npm start"
    echo ""
    echo "Or for development mode:"
    echo "cd packages/bot && npm run dev"
    
else
    echo "❌ Invalid choice"
    exit 1
fi

echo ""
echo "📱 Next: Test your bot in Telegram!"
echo "Send these commands to your bot:"
echo "• /start - Check welcome message"
echo "• /test - Verify system status"