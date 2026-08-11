import { Redis } from '@upstash/redis';
import { env } from '../config/env';

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization: true,
});

export async function checkRedisConnection(): Promise<void> {
  const response = await redis.ping();
  if (response !== 'PONG') {
    throw new Error('Unexpected Redis health-check response');
  }
}
