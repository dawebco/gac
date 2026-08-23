import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { requireCsrf, requireSuperAdmin, SUPER_ADMIN_SESSION_COOKIE } from '../middleware/admin-auth';
import { createSuperAdminSession, revokeAdminSession, rotateAdminCsrfToken } from '../services/admin-auth.service';

const loginSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(8).max(200),
});

export const superAdminAuthRouter: Router = Router();

superAdminAuthRouter.post('/login', async (request, response) => {
  const credentials = loginSchema.parse(request.body);
  const session = await createSuperAdminSession(credentials.username, credentials.password, request);
  response.cookie(SUPER_ADMIN_SESSION_COOKIE, session.sessionToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: `${env.API_PREFIX}/superadmin`,
  });
  response.status(200).json({ data: {
    admin: { username: session.username },
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt.toISOString(),
  } });
});

superAdminAuthRouter.get('/session', requireSuperAdmin, async (_request, response) => {
  const csrfToken = await rotateAdminCsrfToken(response.locals.admin!.sessionId);
  response.status(200).json({ data: { admin: { username: response.locals.admin!.username }, csrfToken } });
});

superAdminAuthRouter.post('/logout', requireSuperAdmin, requireCsrf, async (_request, response) => {
  const admin = response.locals.admin!;
  await revokeAdminSession(admin.sessionId, admin.username, 'SUPER_ADMIN_LOGOUT');
  response.clearCookie(SUPER_ADMIN_SESSION_COOKIE, { path: `${env.API_PREFIX}/superadmin` });
  response.status(204).send();
});
