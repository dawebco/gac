import { argon2idAsync } from '@noble/hashes/argon2';
import { Request } from 'express';
import { env } from '../config/env';
import { query, withTransaction } from '../database/postgres';
import { redis } from '../database/redis';
import { ApiError } from '../shared/api-error';
import { randomToken, safeEqual, sha256 } from '../shared/crypto';

const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 8;

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('$argon2id$')) {
    try {
      const match = storedHash.match(/^\$argon2id\$v=(\d+)\$([^$]+)\$([^$]+)\$([^$]+)$/);
      if (!match) return false;

      const [, versionRaw, parametersRaw, saltRaw, hashRaw] = match;
      const parameters = Object.fromEntries(
        parametersRaw!.split(',').map((parameter) => parameter.split('=', 2)),
      );
      const version = Number(versionRaw);
      const memory = Number(parameters.m);
      const iterations = Number(parameters.t);
      const parallelism = Number(parameters.p);
      if (
        version !== 19
        || !Number.isInteger(memory) || memory < 8 || memory > 262_144
        || !Number.isInteger(iterations) || iterations < 1 || iterations > 10
        || !Number.isInteger(parallelism) || parallelism < 1 || parallelism > 16
      ) return false;

      const salt = Buffer.from(saltRaw!, 'base64');
      const expectedHash = Buffer.from(hashRaw!, 'base64');
      if (salt.length < 8 || expectedHash.length < 16) return false;

      const actualHash = await argon2idAsync(password, salt, {
        version,
        m: memory,
        t: iterations,
        p: parallelism,
        dkLen: expectedHash.length,
        maxmem: 2 ** 32 - 1,
        asyncTick: 10,
      });
      return safeEqual(
        Buffer.from(actualHash).toString('base64url'),
        expectedHash.toString('base64url'),
      );
    } catch {
      return false;
    }
  }
  if (/^[a-f0-9]{64}$/i.test(storedHash)) return safeEqual(sha256(password), storedHash.toLowerCase());
  return false;
}

async function enforceLoginRateLimit(username: string, request: Request, scope: 'admin' | 'superadmin'): Promise<string> {
  const discriminator = sha256(`${request.ip ?? 'unknown'}:${username.toLowerCase()}`);
  const key = `${scope}-login:${discriminator}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, LOGIN_WINDOW_SECONDS);
  if (attempts > MAX_LOGIN_ATTEMPTS) {
    throw new ApiError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts. Try again later.');
  }
  return key;
}

async function createPrivilegedSession(input: {
  username: string;
  password: string;
  request: Request;
  scope: 'admin' | 'superadmin';
  configuredUsername?: string;
  configuredHash?: string;
}) {
  const rateLimitKey = await enforceLoginRateLimit(input.username, input.request, input.scope);
  const configuredUsername = input.configuredUsername;
  const configuredHash = input.configuredHash;
  if (!configuredUsername || !configuredHash) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', `${input.scope === 'superadmin' ? 'Super-admin' : 'Admin'} authentication is not configured.`);
  }

  const passwordValid = await verifyPassword(input.password, configuredHash);
  if (!safeEqual(input.username.trim().toLowerCase(), configuredUsername.toLowerCase()) || !passwordValid) {
    throw new ApiError(401, 'ADMIN_CREDENTIALS_INVALID', 'Incorrect username or password.');
  }
  await redis.del(rateLimitKey);

  const sessionToken = randomToken();
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000);

  const result = await query<{ session_id: string }>(
    `INSERT INTO admin_sessions (
      admin_username, token_hash, csrf_token_hash, user_agent, ip_address_hash, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING session_id`,
    [
      configuredUsername,
      sha256(sessionToken),
      sha256(csrfToken),
      input.request.get('user-agent') ?? null,
      sha256(input.request.ip ?? 'unknown'),
      expiresAt,
    ],
  );

  return { sessionId: result.rows[0]!.session_id, sessionToken, csrfToken, expiresAt, username: configuredUsername };
}

export function createAdminSession(username: string, password: string, request: Request) {
  return createPrivilegedSession({
    username, password, request, scope: 'admin',
    configuredUsername: env.ADMIN_USERNAME,
    configuredHash: env.ADMIN_PASSWORD_HASH,
  });
}

export function createSuperAdminSession(username: string, password: string, request: Request) {
  // Validate against the super-admin credentials only; do not reuse the admin login path.
  return createPrivilegedSession({
    username, password, request, scope: 'superadmin',
    configuredUsername: env.SUPER_ADMIN_USERNAME,
    configuredHash: env.SUPER_ADMIN_PASSWORD_HASH,
  });
}

export async function revokeAdminSession(sessionId: string, username: string, action = 'ADMIN_LOGOUT'): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('UPDATE admin_sessions SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL', [sessionId]);
    await client.query(
      `INSERT INTO admin_audit_logs (admin_username, action, entity_type, entity_id)
       VALUES ($1, $2, 'ADMIN_SESSION', $3)`,
      [username, action, sessionId],
    );
  });
}

export async function rotateAdminCsrfToken(sessionId: string): Promise<string> {
  const csrfToken = randomToken(24);
  await query('UPDATE admin_sessions SET csrf_token_hash = $1, last_seen_at = now() WHERE session_id = $2', [sha256(csrfToken), sessionId]);
  return csrfToken;
}
