import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const postgresPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  allowExitOnIdle: false,
  ssl: env.DATABASE_SSL
    ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED }
    : false,
});

postgresPool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected PostgreSQL pool error');
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  statement: string,
  parameters: unknown[] = [],
): Promise<QueryResult<T>> {
  return postgresPool.query<T>(statement, parameters);
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await postgresPool.connect();

  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkPostgresConnection(): Promise<void> {
  await query('SELECT 1 AS healthy');
}

export async function closePostgresPool(): Promise<void> {
  await postgresPool.end();
}
