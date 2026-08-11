import { AddressInfo } from 'node:net';
import { app } from '../app';
import { env } from '../config/env';
import { closePostgresPool } from '../database/postgres';

function assertStatus(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label} returned HTTP ${actual}; expected ${expected}`);
}

async function main(): Promise<void> {
  const password = process.env.VERIFY_ADMIN_PASSWORD;
  if (!password || !env.ADMIN_USERNAME) throw new Error('VERIFY_ADMIN_PASSWORD and ADMIN_USERNAME are required.');

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}${env.API_PREFIX}`;

  try {
    const loginResponse = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: env.ADMIN_USERNAME, password }),
    });
    assertStatus(loginResponse.status, 200, 'Admin login');
    const loginBody = await loginResponse.json() as { data: { csrfToken: string } };
    const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
    if (!cookie || !loginBody.data.csrfToken) throw new Error('Admin login did not issue session credentials.');

    const sessionResponse = await fetch(`${baseUrl}/admin/auth/session`, { headers: { cookie } });
    assertStatus(sessionResponse.status, 200, 'Admin session restoration');
    const sessionBody = await sessionResponse.json() as { data: { csrfToken: string } };

    const overviewResponse = await fetch(`${baseUrl}/admin/overview`, { headers: { cookie } });
    assertStatus(overviewResponse.status, 200, 'Protected admin overview');

    const logoutResponse = await fetch(`${baseUrl}/admin/auth/logout`, {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': sessionBody.data.csrfToken },
    });
    assertStatus(logoutResponse.status, 204, 'Admin logout');

    console.log(JSON.stringify({
      adminLogin: 'verified',
      httpOnlySessionCookie: 'verified',
      csrfRotation: 'verified',
      protectedAdminRoute: 'verified',
      logoutRevocation: 'verified',
    }, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await closePostgresPool();
  }
}

main().catch((error: unknown) => {
  console.error(`API verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
