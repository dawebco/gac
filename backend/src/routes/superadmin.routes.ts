import { Request, Router } from 'express';
import { z } from 'zod';
import { requireCsrf, requireSuperAdmin } from '../middleware/admin-auth';
import { sha256 } from '../shared/crypto';
import { listRewardAdjustmentRequests, reviewRewardAdjustmentRequest } from '../services/reward.service';
import { listRewardChangeRequests, reviewRewardChangeRequest } from '../services/reward-catalog.service';
import type { AuditContext } from '../services/customer.service';

const statusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']);
const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewNote: z.string().trim().max(500).optional(),
});

export const superAdminRouter: Router = Router();
superAdminRouter.use(requireSuperAdmin);

function auditContext(request: Request): AuditContext {
  return {
    adminUsername: request.res!.locals.admin!.username,
    requestId: request.res!.locals.requestId,
    ipAddressHash: sha256(request.ip ?? 'unknown'),
    userAgent: request.get('user-agent'),
  };
}

superAdminRouter.get('/reward-requests', async (request, response) => {
  const status = statusSchema.default('PENDING').parse(request.query.status);
  response.status(200).json({ data: await listRewardAdjustmentRequests(status) });
});

superAdminRouter.post('/reward-requests/:requestId/review', requireCsrf, async (request, response) => {
  const requestId = z.string().uuid().parse(request.params.requestId);
  const input = reviewSchema.parse(request.body);
  const data = await reviewRewardAdjustmentRequest({
    requestId,
    ...input,
    superAdminUsername: response.locals.admin!.username,
    audit: auditContext(request),
  });
  response.status(200).json({ data });
});

superAdminRouter.get('/reward-change-requests', async (request, response, next) => {
  try {
    const status = statusSchema.default('PENDING').parse(request.query.status);
    response.status(200).json({ data: await listRewardChangeRequests(status) });
  } catch (error) {
    next(error);
  }
});

superAdminRouter.post('/reward-change-requests/:requestId/review', requireCsrf, async (request, response, next) => {
  try {
    const requestId = z.string().uuid().parse(request.params.requestId);
    const input = reviewSchema.parse(request.body);
    const data = await reviewRewardChangeRequest({
      requestId,
      ...input,
      superAdminUsername: response.locals.admin!.username,
      audit: auditContext(request),
    });
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});
