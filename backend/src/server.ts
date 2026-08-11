import { createServer } from 'node:http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { closePostgresPool } from './database/postgres';

const server = createServer(app);
let shuttingDown = false;

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.fatal({ port: env.PORT }, `Port ${env.PORT} is already in use. Stop the other backend process and retry.`);
  } else {
    logger.fatal({ err: error }, 'HTTP server failed');
  }

  if (!server.listening) {
    void closePostgresPool().finally(() => process.exit(1));
    return;
  }
  void shutdown('SIGTERM');
});

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, apiPrefix: env.API_PREFIX }, 'GAC Holidays API started');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Graceful shutdown started');
  const forceExitTimer = setTimeout(() => {
    logger.fatal('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (serverError) => {
    try {
      if (serverError) throw serverError;
      await closePostgresPool();
      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Graceful shutdown failed');
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown('SIGTERM');
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('SIGTERM');
});
