import { randomUUID } from 'node:crypto';
import { Request, Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAdmin, requireCsrf } from '../middleware/admin-auth';
import { sha256 } from '../shared/crypto';
import { normalizeIndianPhone } from '../shared/phone';
import { createBooking, listBookings, voidBooking } from '../services/booking.service';
import {
  createAdminCustomer,
  getAdminCustomer,
  getAdminOverview,
  listAdminCustomers,
  type AuditContext,
} from '../services/customer.service';
import { getUnifiedDashboard, requestRewardAdjustment } from '../services/reward.service';
import { createReward, deleteReward, listRewards, updateReward } from '../services/reward-catalog.service';
import { listPendingRedemptionRequests, reviewRedemptionRequest } from '../services/reward-redemption.service';
import { ApiError } from '../shared/api-error';

const bookingTypeSchema = z.enum(['FLIGHTS', 'HOTELS', 'HOLIDAYS']);
const bookingSchema = z.object({
  bookingType: bookingTypeSchema,
  purchasedAmount: z.coerce.number().positive().max(100_000_000),
  bookingDate: z.string().date(),
});
const customerSchema = z.object({
  phone: z.string().trim().min(10).max(20),
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(255).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional(),
  booking: bookingSchema.optional(),
});
const adjustmentSchema = z.object({
  direction: z.enum(['ADD', 'REMOVE']),
  points: z.coerce.number().int().positive().max(10_000_000),
  reason: z.string().trim().min(3).max(500),
});
const voidSchema = z.object({
  reason: z.string().trim().min(3).max(500).default('Booking removed by administrator'),
});
const rewardBaseSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(3).max(2000),
  pointsRequired: z.coerce.number().int().positive().max(100_000_000),
});
const rewardCreateSchema = rewardBaseSchema.extend({
  category: z.enum(['FEATURED', 'MILESTONE']),
});
const rewardUpdateSchema = rewardBaseSchema.partial();
const rewardImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new ApiError(400, 'INVALID_REWARD_IMAGE', 'Upload a JPG, PNG, or WebP image.'));
      return;
    }
    callback(null, true);
  },
});

export const adminRouter = Router();
adminRouter.use(requireAdmin);

function auditContext(request: Request): AuditContext {
  return {
    adminUsername: request.res!.locals.admin!.username,
    requestId: request.res!.locals.requestId,
    ipAddressHash: sha256(request.ip ?? 'unknown'),
    userAgent: request.get('user-agent'),
  };
}

adminRouter.get('/overview', async (_request, response) => {
  response.status(200).json({ data: await getAdminOverview() });
});

adminRouter.get('/rewards', async (_request, response) => {
  response.status(200).json({ data: await listRewards() });
});

/**
 * GET /admin/redemption-requests
 * Admin lists all pending redemption requests.
 */
adminRouter.get('/redemption-requests', async (_req, res, next) => {
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
adminRouter.post('/redemption-requests/:requestId/review', requireCsrf, async (req, res, next) => {
  try {
    const { decision, reviewNote } = req.body;
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      throw new ApiError(400, 'BAD_REQUEST', 'Decision must be APPROVE or REJECT.');
    }
    const result = await reviewRedemptionRequest({ requestId: z.string().uuid().parse(req.params.requestId), decision, reviewNote, audit: auditContext(req) });
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/rewards', requireCsrf, rewardImageUpload.single('image'), async (request, response) => {
  const input = rewardCreateSchema.parse(request.body);
  const data = await createReward({
    ...input,
    image: request.file,
    audit: auditContext(request),
  });
  response.status(201).json({ data });
});

adminRouter.patch('/rewards/:rewardId', requireCsrf, rewardImageUpload.single('image'), async (request, response) => {
  const rewardId = z.string().uuid().parse(request.params.rewardId);
  const input = rewardUpdateSchema.parse(request.body);
  const data = await updateReward({
    rewardId,
    ...input,
    image: request.file,
    audit: auditContext(request),
  });
  response.status(200).json({ data });
});

adminRouter.delete('/rewards/:rewardId', requireCsrf, async (request, response) => {
  const rewardId = z.string().uuid().parse(request.params.rewardId);
  const data = await deleteReward({ rewardId, audit: auditContext(request) });
  response.status(200).json({ data });
});

adminRouter.get('/customers', async (request, response) => {
  const filters = z.object({
    search: z.string().max(150).default(''),
    limit: z.coerce.number().int().min(1).max(250).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  }).parse(request.query);
  response.status(200).json({ data: await listAdminCustomers(filters.search, filters.limit, filters.offset) });
});

adminRouter.post('/customers', requireCsrf, async (request, response) => {
  const input = customerSchema.parse(request.body);
  const audit = auditContext(request);
  const data = await createAdminCustomer({
    ...input,
    email: input.email || undefined,
    booking: input.booking ? {
      ...input.booking,
      idempotencyKey: request.header('idempotency-key')?.trim() || randomUUID(),
    } : undefined,
  }, audit);
  response.status(201).json({ data });
});

adminRouter.get('/customers/:phone', async (request, response) => {
  const phoneE164 = normalizeIndianPhone(String(request.params.phone));
  const [customer, bookings, dashboard] = await Promise.all([
    getAdminCustomer(phoneE164),
    listBookings(phoneE164),
    getUnifiedDashboard(phoneE164),
  ]);
  response.status(200).json({ data: { ...customer, bookings, dashboard } });
});

adminRouter.get('/customers/:phone/dashboard', async (request, response) => {
  const phoneE164 = normalizeIndianPhone(String(request.params.phone));
  response.status(200).json({ data: await getUnifiedDashboard(phoneE164) });
});

adminRouter.post('/customers/:phone/bookings', requireCsrf, async (request, response) => {
  const phoneE164 = normalizeIndianPhone(String(request.params.phone));
  const input = bookingSchema.parse(request.body);
  const adminUsername = response.locals.admin!.username;
  const data = await createBooking({
    ...input,
    phoneE164,
    adminUsername,
    idempotencyKey: request.header('idempotency-key')?.trim() || randomUUID(),
    audit: auditContext(request),
  });
  response.status(201).json({ data });
});

adminRouter.delete('/customers/:phone/bookings/:bookingId', requireCsrf, async (request, response) => {
  const phoneE164 = normalizeIndianPhone(String(request.params.phone));
  const input = voidSchema.parse(request.body ?? {});
  const data = await voidBooking({
    phoneE164,
    bookingId: z.string().uuid().parse(request.params.bookingId),
    reason: input.reason,
    adminUsername: response.locals.admin!.username,
    audit: auditContext(request),
  });
  response.status(200).json({ data });
});

adminRouter.post('/customers/:phone/reward-adjustments', requireCsrf, async (request, response) => {
  const phoneE164 = normalizeIndianPhone(String(request.params.phone));
  const input = adjustmentSchema.parse(request.body);
  const data = await requestRewardAdjustment({
    ...input,
    phoneE164,
    adminUsername: response.locals.admin!.username,
    idempotencyKey: request.header('idempotency-key')?.trim(),
    audit: auditContext(request),
  });
  response.status(201).json({ data });
});
