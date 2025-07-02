#!/usr/bin/env node

import express from 'express';
import { config, logConfigStatus } from './config/index.js';
import { logger, logStartup } from './utils/logger.js';
import { testConnection } from './services/database.js';
import { testRedisConnection } from './services/session.js';
import { healthRouter } from './server/healthCheck.js';
import { createBot, startPolling, setupWebhook } from './bot.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Log startup information
    logStartup();
    logConfigStatus();

    // Test connections
    logger.info('🔍 Testing connections...');
    
    const [dbConnected, redisConnected] = await Promise.all([
      testConnection(),
      testRedisConnection(),
    ]);

    if (!dbConnected) {
      logger.warn('⚠️  Database connection failed - some features may not work');
    }

    if (!redisConnected) {
      logger.warn('⚠️  Redis connection failed - sessions may not persist');
    }

    // Create bot instance
    const bot = createBot();

    // Set up health check server
    const app = express();
    app.use(express.json());
    app.use(healthRouter);

    // Start health check server
    const server = app.listen(config.PORT, () => {
      logger.info(`🏠 Health check server running on port ${config.PORT}`);
    });

    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`📴 Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        logger.info('🏠 Health check server closed');
        
        bot.stop(signal);
        logger.info('🤖 Bot stopped');
        
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Start bot based on environment
    if (config.NODE_ENV === 'production' && config.WEBHOOK_URL) {
      // Production: Use webhook
      await setupWebhook(bot);
      
      // Add webhook endpoint to express app
      app.use(bot.webhookCallback('/webhook'));
      logger.info('🔗 Bot running in webhook mode');
    } else {
      // Development: Use polling
      await startPolling(bot);
    }

    logger.info('🎉 Cabal.Ventures Bot is fully operational!');
  } catch (error) {
    logger.error('💥 Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});