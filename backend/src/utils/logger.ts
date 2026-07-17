import pino from 'pino';
import { config } from '../config/index.js';

const isDev = config.env === 'development';

export const logger = pino({
  level: config.logLevel,
  base: { service: 'mockhub-backend' },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});

export type Logger = typeof logger;
