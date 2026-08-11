import { NextFunction, Request, Response } from 'express';
import { query } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import { safeEqual, sha256 } from '../shared/crypto';

export const ADMIN_SESSION_COOKIE = 'gac_admin_session';

export interface AdminIdentity {
  username: string;
  sessionId: string;
  csrfTokenHash: string;
}

declare global {
  namespace Express {
    interface Locals {
      admin?: AdminIdentity;
      requestId?: string;
    }
  }
}

export async function requireAdmin(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = request.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
    if (!rawToken) throw new ApiError(401, 'ADMIN_AUTH_REQUIRED', 'Admin authentication is required.');

    const result = await query<{
      session_id: string;
      admin_username: string;
      csrf_token_hash: string;
    }>(
      `SELECT session_id, admin_username, csrf_token_hash
       FROM admin_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [sha256(rawToken)],
    );
    const session = result.rows[0];
    if (!session) throw new ApiError(401, 'ADMIN_SESSION_INVALID', 'The admin session is invalid or expired.');

    response.locals.admin = {
      username: session.admin_username,
      sessionId: session.session_id,
      csrfTokenHash: session.csrf_token_hash,
    };

    void query('UPDATE admin_sessions SET last_seen_at = now() WHERE session_id = $1', [session.session_id]);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireCsrf(request: Request, response: Response, next: NextFunction): void {
  try {
    const csrfToken = request.header('x-csrf-token')?.trim();
    const expectedHash = response.locals.admin?.csrfTokenHash;
    if (!csrfToken || !expectedHash || !safeEqual(sha256(csrfToken), expectedHash)) {
      throw new ApiError(403, 'CSRF_TOKEN_INVALID', 'The request security token is missing or invalid.');
    }
    next();
  } catch (error) {
    next(error);
  }
}
