import { NextFunction, Request, Response } from 'express';
import { query } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import { sha256 } from '../shared/crypto';

export const CUSTOMER_SESSION_COOKIE = 'gac_customer_session';

export async function requireCustomer(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const request = _request;
    const rawToken = request.cookies?.[CUSTOMER_SESSION_COOKIE] as string | undefined;
    if (!rawToken) throw new ApiError(401, 'CUSTOMER_AUTH_REQUIRED', 'Customer authentication is required.');
    const result = await query<{ session_id: string; phone_e164: string }>(
      `SELECT session_id, phone_e164 FROM customer_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1`,
      [sha256(rawToken)],
    );
    const session = result.rows[0];
    if (!session) throw new ApiError(401, 'CUSTOMER_SESSION_INVALID', 'The customer session is invalid or expired.');
    response.locals.customer = { phoneE164: session.phone_e164, sessionId: session.session_id };
    void query('UPDATE customer_sessions SET last_seen_at = now() WHERE session_id = $1', [session.session_id]);
    next();
  } catch (error) {
    next(error);
  }
}

declare global {
  namespace Express {
    interface Locals {
      customer?: { phoneE164: string; sessionId: string };
    }
  }
}
