import express, { Request, Response } from 'express';
import { config } from '../config/index.js';
import { testConnection } from '../services/database.js';
import { testRedisConnection } from '../services/session.js';
import { logger } from '../utils/logger.js';
import type { HealthCheckResponse } from '../types/index.js';

/**
 * Health check router
 */
export const healthRouter: express.Router = express.Router();

/**
 * Store startup time for uptime calculation
 */
const startTime = Date.now();

/**
 * Health check endpoint
 * GET /healthz
 */
healthRouter.get('/healthz', async (req: Request, res: Response) => {
  try {
    // Calculate uptime
    const uptimeMs = Date.now() - startTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeString = formatUptime(uptimeSeconds);

    // Basic health check response
    const healthResponse: HealthCheckResponse = {
      status: 'ok',
      uptime: uptimeString,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };

    // Test connections if detailed parameter is provided
    if (req.query.detailed === 'true') {
      const [dbStatus, redisStatus] = await Promise.all([
        testConnection().catch(() => false),
        testRedisConnection().catch(() => false),
      ]);

      const detailedResponse = {
        ...healthResponse,
        services: {
          database: dbStatus ? 'connected' : 'error',
          redis: redisStatus ? 'connected' : 'error',
        },
        environment: config.NODE_ENV,
      };

      // Set status to 'degraded' if any service is down
      if (!dbStatus || !redisStatus) {
        detailedResponse.status = 'degraded';
        res.status(503);
      }

      res.json(detailedResponse);
      return;
    }

    res.json(healthResponse);
    return;
  } catch (error) {
    logger.error('Health check error:', error);
    
    const errorResponse: HealthCheckResponse = {
      status: 'error',
      uptime: 'unknown',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(errorResponse);
  }
});

/**
 * Format uptime seconds into human readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];
  
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}