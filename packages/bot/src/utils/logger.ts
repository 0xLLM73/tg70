import winston from 'winston';
import { config } from '../config/index.js';

/**
 * Custom log format that removes sensitive information
 */
const sanitizeFormat = winston.format((info: winston.Logform.TransformableInfo) => {
  const message = String(info.message || '');
  // Remove potential bot tokens from logs
  const cleanMessage = message.replace(/\b\d+:[A-Za-z0-9_-]{35}\b/g, '[BOT_TOKEN]');
  // Remove potential API keys
  (info as any).message = cleanMessage.replace(/\b[A-Za-z0-9]{32,}\b/g, '[API_KEY]');
  return info;
});

/**
 * Logger configuration
 */
export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    sanitizeFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cabal-bot' },
  transports: [
    // Write all logs with importance level of `info` or less to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info: winston.Logform.TransformableInfo) => {
          const { timestamp, level, message, ...meta } = info;
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
        })
      ),
    }),
  ],
});

/**
 * Log bot startup information
 */
export function logStartup(): void {
  logger.info('🤖 Cabal.Ventures Telegram Bot starting up...');
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`Version: 0.1.0`);
}