import { closePostgresPool, query } from '../database/postgres';
import { redis } from '../database/redis';

const requiredTables = [
  'admin_audit_logs',
  'admin_customer_records',
  'admin_sessions',
  'booking_events',
  'bookings',
  'customer_auth',
  'customer_reward_balances',
  'customer_sessions',
  'customer_subjects',
  'domain_events',
  'packages',
  'portal_customer_profiles',
  'reward_accounts',
  'reward_catalog',
  'reward_ledger',
  'reward_rules',
] as const;

async function main(): Promise<void> {
  const [databaseResult, redisResult] = await Promise.all([
    query<{ database: string; role: string; version: string }>(
      "SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version",
    ),
    redis.ping(),
  ]);

  const relations = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  const views = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name",
  );
  const tableNames = new Set(relations.rows.map(({ table_name }) => table_name));
  const missingTables = requiredTables.filter((table) => !tableNames.has(table));

  console.log(JSON.stringify({
    postgres: {
      connected: true,
      ...databaseResult.rows[0],
      tablesFound: relations.rowCount,
      missingTables,
      views: views.rows.map(({ table_name }) => table_name),
    },
    redis: {
      connected: redisResult === 'PONG',
      response: redisResult,
    },
    schemaReady: missingTables.length === 0,
  }, null, 2));

  if (missingTables.length > 0 || redisResult !== 'PONG') {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    const details = error && typeof error === 'object'
      ? {
          name: 'name' in error ? String(error.name) : 'UnknownError',
          message: 'message' in error ? String(error.message) : 'No error message supplied',
          code: 'code' in error ? String(error.code) : undefined,
          cause: 'cause' in error && error.cause && typeof error.cause === 'object' && 'message' in error.cause
            ? String(error.cause.message)
            : undefined,
        }
      : { name: 'UnknownError', message: String(error) };
    console.error('Infrastructure verification failed:', details);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
