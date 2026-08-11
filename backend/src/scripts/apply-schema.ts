import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { closePostgresPool, query } from '../database/postgres';

async function main(): Promise<void> {
  const schemaPath = path.resolve(__dirname, '..', '..', 'schema.sql');
  const schema = await readFile(schemaPath, 'utf8');
  await query(schema);
  console.log('Database schema applied successfully.');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Database schema migration failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
