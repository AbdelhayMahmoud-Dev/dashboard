import http from 'http';
// Validates process.env at module load — fails fast with a clear single-line error
// if any required var is missing or weak. Must come before any other backend
// module that reads from process.env.
import { env } from './config/env';
import app from './app';
import { logger } from './utils/logger';
import connectDB from './config/db';
import { initRedis } from './config/redis';
import { initSocket } from './socket';

const PORT = env.PORT;

const startServer = async () => {
  try {
    await connectDB();
    initRedis(); // non-blocking — app works without Redis

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      logger.error('Unhandled rejection', { reason: message });
      httpServer.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err: Error) => {
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received — shutting down gracefully');
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received — shutting down gracefully');
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
};

startServer();
