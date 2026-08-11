import { Router } from 'express';
import { env } from '../config/env';
import { checkPostgresConnection } from '../database/postgres';
import { checkRedisConnection } from '../database/redis';

export const healthRouter = Router();

healthRouter.get('/live', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: env.APP_NAME,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/ready', async (_request, response) => {
  const startedAt = Date.now();
  const [database, redis] = await Promise.allSettled([
    checkPostgresConnection(),
    checkRedisConnection(),
  ]);

  const checks = {
    postgres: database.status === 'fulfilled' ? 'up' : 'down',
    redis: redis.status === 'fulfilled' ? 'up' : 'down',
    supabaseClient: 'configured',
  } as const;
  const ready = database.status === 'fulfilled' && redis.status === 'fulfilled';

  response.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    durationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});
