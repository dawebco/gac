import { ensureRewardBucket } from '../services/reward-catalog.service';
import { closePostgresPool } from '../database/postgres';

ensureRewardBucket()
  .then(() => console.log('Reward image storage is ready.'))
  .catch((error: unknown) => {
    console.error(`Reward storage setup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => closePostgresPool());
