import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      logFormat
    ),
  }),
];

// File transports are only safe on a host with a writable, persistent
// filesystem. Vercel serverless functions run on a read-only FS (only /tmp is
// writable, and it is ephemeral), so creating DailyRotateFile transports there
// crashes the function on cold start. Vercel sets VERCEL=1, which we use to
// skip file logging and rely on the Console transport (captured by Vercel's
// log drains) instead. Long-lived hosts (Render, Docker, a VM) keep file logs.
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const logsDir = path.join(process.cwd(), 'logs');

  transports.push(
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    }),
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: combine(timestamp(), errors({ stack: true }), logFormat),
  transports,
  exitOnError: false,
});

export const morganStream = {
  write: (message: string) => logger.http(message.trimEnd()),
};
