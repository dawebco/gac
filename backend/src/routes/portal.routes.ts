import { Response, Router } from 'express';
import { z } from 'zod';
import { redis } from '../database/redis';
import { ApiError } from '../shared/api-error';
import { sha256 } from '../shared/crypto';
import { createDummyCustomerLogin, getCustomerDisplayProfile, registerPortalCustomer } from '../services/customer.service';
import { getUnifiedDashboard } from '../services/reward.service';
import { CUSTOMER_SESSION_COOKIE, requireCustomer } from '../middleware/customer-auth';
import { env } from '../config/env';
import { query } from '../database/postgres';
import { listBookings } from '../services/booking.service';
import { listRewards } from '../services/reward-catalog.service';
import { listCustomerRedemptions, requestRedemption } from '../services/reward-redemption.service';
import { sendWhatsAppOtpMessage } from '../services/whatsapp.service';

const registrationSchema = z.object({
  phone: z.string().trim().min(10).max(20),
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  dateOfBirth: z.string().date().optional(),
});
const dummyLoginSchema = z.object({
  phone: z.string().trim().min(10).max(20),
  otp: z.string().regex(/^\d{4}$/, 'Enter any four digits.'),
});

export const portalRouter: Router = Router();

function setCustomerSessionCookie(response: Response, sessionToken: string): void {
  // Customer portal sessions must be isolated from admin and super-admin cookies.
  response.cookie(CUSTOMER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: env.CUSTOMER_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: `${env.API_PREFIX}/portal`,
  });
}

portalRouter.get('/rewards', async (_request, response) => {
  response.status(200).json({ data: await listRewards() });
});

/**
 * POST /portal/rewards/redeem
 * Customer requests to redeem a reward.
 */
portalRouter.post('/rewards/redeem', requireCustomer, async (req, res, next) => {
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
      phone: res.locals.customer!.phoneE164,
      rewardId,
      idempotencyKey,
    });

    res.status(202).json({ data: { message: 'Redemption request submitted for approval.' } });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'DUPLICATE_REQUEST') {
      return res.status(200).json({ data: { message: 'Redemption request already submitted.' } });
    }
    next(error);
  }
});

portalRouter.post('/customers/register', async (request, response) => {
  const key = `portal-register:${sha256(request.ip ?? 'unknown')}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, 60 * 60);
  if (attempts > 10) throw new ApiError(429, 'REGISTRATION_RATE_LIMITED', 'Too many registration attempts. Try again later.');

  const input = registrationSchema.parse(request.body);
  const registration = await registerPortalCustomer(input);
  const [dashboard, bookings, rewards, redemptions] = await Promise.all([
    getUnifiedDashboard(registration.profile.phoneE164),
    listBookings(registration.profile.phoneE164),
    listRewards(),
    listCustomerRedemptions(registration.profile.phoneE164),
  ]);
  const redeemedRewards = redemptions.filter(r => r.status === 'APPROVED');
  const pendingRedemptions = redemptions.filter(r => r.status === 'PENDING');
  setCustomerSessionCookie(response, registration.sessionToken);
  response.status(201).json({ data: { profile: registration.profile, dashboard, bookings, rewards, redeemedRewards, pendingRedemptions } });
});

portalRouter.post('/auth/send-otp', async (request, response) => {
  const input = dummyLoginSchema.pick({ phone: true }).parse(request.body);
  const phoneClean = input.phone.replace(/[^0-9]/g, '');
  const phoneE164 = phoneClean.length === 10 ? `+91${phoneClean}` : `+${phoneClean}`;

  const rateLimitKey = `send-otp:${sha256(`${request.ip ?? 'unknown'}:${phoneE164}`)}`;
  const attempts = await redis.incr(rateLimitKey);
  if (attempts === 1) await redis.expire(rateLimitKey, 60);
  if (attempts > 5) throw new ApiError(429, 'RATE_LIMITED', 'Too many OTP requests. Please wait a minute before requesting another code.');

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  await redis.set(`otp:${phoneE164}`, otp, 'EX', 300);

  if (env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_CLOUD_API_TOKEN) {
    try {
      await sendWhatsAppOtpMessage({ phoneE164, otp });
    } catch (err: any) {
      console.error('Failed to dispatch WhatsApp OTP:', err);
    }
  } else {
    console.log(`[OTP DEBUG] OTP for ${phoneE164} is: ${otp}`);
  }

  response.status(200).json({ data: { message: 'OTP sent successfully to your WhatsApp number.' } });
});

portalRouter.post('/auth/verify-otp', async (request, response) => {
  const input = dummyLoginSchema.parse(request.body);
  const phoneClean = input.phone.replace(/[^0-9]/g, '');
  const phoneE164 = phoneClean.length === 10 ? `+91${phoneClean}` : `+${phoneClean}`;

  const storedOtp = await redis.get(`otp:${phoneE164}`);
  const isMatch = (storedOtp && storedOtp === input.otp) || (env.ENABLE_DUMMY_OTP_AUTH && input.otp.length === 4);

  if (!isMatch) {
    throw new ApiError(400, 'INVALID_OTP', 'Invalid or expired OTP code. Please request a new one.');
  }

  await redis.del(`otp:${phoneE164}`);

  const login = await createDummyCustomerLogin(input.phone);
  const [dashboard, bookings, rewards, redemptions] = await Promise.all([
    getUnifiedDashboard(login.profile.phoneE164),
    listBookings(login.profile.phoneE164),
    listRewards(),
    listCustomerRedemptions(login.profile.phoneE164),
  ]);
  const redeemedRewards = redemptions.filter(r => r.status === 'APPROVED');
  const pendingRedemptions = redemptions.filter(r => r.status === 'PENDING');
  setCustomerSessionCookie(response, login.sessionToken);
  response.status(200).json({ data: { profile: login.profile, dashboard, bookings, rewards, redeemedRewards, pendingRedemptions } });
});

portalRouter.post('/auth/dummy-login', async (request, response) => {
  if (!env.ENABLE_DUMMY_OTP_AUTH) {
    throw new ApiError(503, 'DUMMY_OTP_DISABLED', 'Dummy OTP login is disabled.');
  }
  const input = dummyLoginSchema.parse(request.body);
  const rateLimitKey = `dummy-login:${sha256(`${request.ip ?? 'unknown'}:${input.phone}`)}`;
  const attempts = await redis.incr(rateLimitKey);
  if (attempts === 1) await redis.expire(rateLimitKey, 15 * 60);
  if (attempts > 20) throw new ApiError(429, 'DUMMY_LOGIN_RATE_LIMITED', 'Too many login attempts. Try again later.');

  const login = await createDummyCustomerLogin(input.phone);
  const [dashboard, bookings, rewards, redemptions] = await Promise.all([
    getUnifiedDashboard(login.profile.phoneE164),
    listBookings(login.profile.phoneE164),
    listRewards(),
    listCustomerRedemptions(login.profile.phoneE164),
  ]);
  const redeemedRewards = redemptions.filter(r => r.status === 'APPROVED');
  const pendingRedemptions = redemptions.filter(r => r.status === 'PENDING');
  setCustomerSessionCookie(response, login.sessionToken);
  response.status(200).json({ data: { profile: login.profile, dashboard, bookings, rewards, redeemedRewards, pendingRedemptions } });
});

portalRouter.get('/session/dashboard', requireCustomer, async (_request, response) => {
  const phoneE164 = response.locals.customer!.phoneE164;
  const [profile, dashboard, bookings, rewards, redemptions] = await Promise.all([
    getCustomerDisplayProfile(phoneE164),
    getUnifiedDashboard(phoneE164),
    listBookings(phoneE164),
    listRewards(),
    listCustomerRedemptions(phoneE164),
  ]);
  const redeemedRewards = redemptions.filter(r => r.status === 'APPROVED');
  const pendingRedemptions = redemptions.filter(r => r.status === 'PENDING');
  response.status(200).json({ data: { profile, dashboard, bookings, rewards, redeemedRewards, pendingRedemptions } });
});

portalRouter.post('/session/logout', requireCustomer, async (_request, response) => {
  await query('UPDATE customer_sessions SET revoked_at = now() WHERE session_id = $1', [response.locals.customer!.sessionId]);
  response.clearCookie(CUSTOMER_SESSION_COOKIE, { path: `${env.API_PREFIX}/portal` });
  response.status(204).send();
});
