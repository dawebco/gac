import { Router } from 'express';
import { requireAdminSession, requireCustomerSession } from '../middleware/auth.middleware';
import { listPendingRedemptionRequests, requestRedemption, reviewRedemptionRequest } from '../services/reward-redemption.service';
import { ApiError } from '../shared/api-error';
import { getAuditContext } from '../services/audit.service';

export const portalRedemptionRouter = Router();
export const adminRedemptionRouter = Router();

/**
 * POST /portal/rewards/redeem
 * Customer requests to redeem a reward.
 */
portalRedemptionRouter.post('/redeem', requireCustomerSession, async (req, res, next) => {
  try {
    const { rewardId } = req.body;
    const idempotencyKey = req.get('Idempotency-Key');
    if (!rewardId || typeof rewardId !== 'string') {
      throw new ApiError(400, 'BAD_REQUEST', 'Missing or invalid rewardId.');
    }
    if (!idempotencyKey) {
      throw new ApiError(400, 'BAD_REQUEST', 'Idempotency-Key header is required.');
    }

    await requestRedemption({
      phone: req.session!.phone!,
      rewardId,
      idempotencyKey,
    });

    res.status(202).json({ ok: true, data: { message: 'Redemption request submitted for approval.' } });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'DUPLICATE_REQUEST') {
      return res.status(200).json({ ok: true, data: { message: 'Redemption request already submitted.' } });
    }
    next(error);
  }
});

adminRedemptionRouter.use(requireAdminSession);

/**
 * GET /admin/redemption-requests
 * Admin lists all pending redemption requests.
 */
adminRedemptionRouter.get('/', async (req, res, next) => {
  try {
    const requests = await listPendingRedemptionRequests();
    res.json({ ok: true, data: requests });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/redemption-requests/:requestId/review
 * Admin approves or rejects a redemption request.
 */
adminRedemptionRouter.post('/:requestId/review', async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { decision, reviewNote } = req.body;
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      throw new ApiError(400, 'BAD_REQUEST', 'Decision must be APPROVE or REJECT.');
    }
    const result = await reviewRedemptionRequest({ requestId, decision, reviewNote, audit: getAuditContext(req) });
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});