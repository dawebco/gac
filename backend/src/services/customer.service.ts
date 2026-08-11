import { PoolClient } from 'pg';
import { query, withTransaction } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import { normalizeIndianPhone, nationalPhone } from '../shared/phone';
import { writeAdminAudit } from './audit.service';
import { createBookingInTransaction, type CreateBookingInput } from './booking.service';
import { env } from '../config/env';
import { randomToken, sha256 } from '../shared/crypto';

export interface AuditContext {
  adminUsername: string;
  requestId?: string;
  ipAddressHash?: string;
  userAgent?: string;
}

interface CustomerRow {
  phone_e164: string;
  display_name: string;
  email: string | null;
  notes: string | null;
  created_at: Date;
  total_bookings: number;
  available_points: number;
  total_points_earned: number;
  total_points_redeemed: number;
}

export function mapCustomer(row: CustomerRow) {
  return {
    phoneE164: row.phone_e164,
    phone: nationalPhone(row.phone_e164),
    name: row.display_name,
    email: row.email ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
    totalBookings: Number(row.total_bookings),
    availablePoints: Number(row.available_points),
    totalPointsEarned: Number(row.total_points_earned),
    totalPointsRedeemed: Number(row.total_points_redeemed),
  };
}

const customerSelect = `
  SELECT record.phone_e164, record.display_name, record.email, record.notes, record.created_at,
         coalesce(summary.total_bookings, 0)::integer AS total_bookings,
         coalesce(summary.available_points, 0)::integer AS available_points,
         coalesce(summary.total_points_earned, 0)::integer AS total_points_earned,
         coalesce(summary.total_points_redeemed, 0)::integer AS total_points_redeemed
  FROM admin_customer_records record
  LEFT JOIN customer_dashboard_summary summary ON summary.phone_e164 = record.phone_e164`;

export async function listAdminCustomers(search = '', limit = 100, offset = 0) {
  const normalizedSearch = search.trim();
  const result = await query<CustomerRow>(
    `${customerSelect}
     WHERE record.record_status = 'ACTIVE'
       AND ($1 = '' OR record.display_name ILIKE '%' || $1 || '%'
         OR coalesce(record.email, '') ILIKE '%' || $1 || '%'
         OR record.phone_e164 LIKE '%' || regexp_replace($1, '[^0-9]', '', 'g') || '%')
     ORDER BY record.created_at DESC
     LIMIT $2 OFFSET $3`,
    [normalizedSearch, limit, offset],
  );
  return result.rows.map(mapCustomer);
}

export async function getAdminCustomer(phoneInput: string, client?: PoolClient) {
  const phoneE164 = normalizeIndianPhone(phoneInput);
  const statement = `${customerSelect} WHERE record.phone_e164 = $1 AND record.record_status = 'ACTIVE' LIMIT 1`;
  const result = client
    ? await client.query<CustomerRow>(statement, [phoneE164])
    : await query<CustomerRow>(statement, [phoneE164]);
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found.');
  return mapCustomer(row);
}

export interface CreateAdminCustomerInput {
  phone: string;
  name: string;
  email?: string;
  notes?: string;
  booking?: Omit<CreateBookingInput, 'phoneE164' | 'adminUsername' | 'audit'>;
}

export async function createAdminCustomer(input: CreateAdminCustomerInput, audit: AuditContext) {
  const phoneE164 = normalizeIndianPhone(input.phone);
  return withTransaction(async (client) => {
    const existing = await client.query('SELECT 1 FROM admin_customer_records WHERE phone_e164 = $1', [phoneE164]);
    if (existing.rowCount) {
      throw new ApiError(409, 'ADMIN_CUSTOMER_EXISTS', 'This mobile number already exists. Manage the customer instead.', {
        phoneE164,
      });
    }

    await client.query(
      `INSERT INTO customer_subjects (phone_e164) VALUES ($1)
       ON CONFLICT (phone_e164) DO UPDATE SET status = 'ACTIVE'`,
      [phoneE164],
    );
    await client.query(
      `INSERT INTO admin_customer_records (phone_e164, display_name, email, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [phoneE164, input.name.trim(), input.email?.trim().toLowerCase() || null, input.notes?.trim() || null, audit.adminUsername],
    );
    await ensureRewardAccount(client, phoneE164);

    if (input.booking) {
      await createBookingInTransaction(client, {
        ...input.booking,
        phoneE164,
        adminUsername: audit.adminUsername,
        audit,
      });
    }

    await writeAdminAudit(client, {
      ...audit,
      action: 'CUSTOMER_CREATED',
      entityType: 'ADMIN_CUSTOMER_RECORD',
      entityId: phoneE164,
      afterData: { phoneE164, name: input.name, email: input.email ?? null },
    });

    return getAdminCustomer(phoneE164, client);
  });
}

export async function registerPortalCustomer(input: {
  phone: string;
  name: string;
  email: string;
  dateOfBirth?: string;
}) {
  const phoneE164 = normalizeIndianPhone(input.phone);
  return withTransaction(async (client) => {
    const existing = await client.query('SELECT 1 FROM portal_customer_profiles WHERE phone_e164 = $1', [phoneE164]);
    if (existing.rowCount) throw new ApiError(409, 'PORTAL_CUSTOMER_EXISTS', 'A portal account already exists for this mobile number.');

    await client.query(
      `INSERT INTO customer_subjects (phone_e164) VALUES ($1)
       ON CONFLICT (phone_e164) DO UPDATE SET status = 'ACTIVE'`,
      [phoneE164],
    );
    const profileResult = await client.query<{
      phone_e164: string;
      full_name: string;
      email: string;
      date_of_birth: string | null;
    }>(
      `INSERT INTO portal_customer_profiles (phone_e164, full_name, email, date_of_birth)
       VALUES ($1, $2, $3, $4)
       RETURNING phone_e164, full_name, email, date_of_birth`,
      [phoneE164, input.name.trim(), input.email.trim().toLowerCase(), input.dateOfBirth || null],
    );
    await client.query(
      `INSERT INTO customer_auth (phone_e164, auth_status) VALUES ($1, 'PENDING')
       ON CONFLICT (phone_e164) DO NOTHING`,
      [phoneE164],
    );
    await ensureRewardAccount(client, phoneE164);
    const profile = profileResult.rows[0]!;
    const sessionToken = randomToken();
    const expiresAt = new Date(Date.now() + env.CUSTOMER_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO customer_sessions (phone_e164, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [phoneE164, sha256(sessionToken), expiresAt],
    );
    return {
      profile: {
        phoneE164: profile.phone_e164,
        phone: nationalPhone(profile.phone_e164),
        name: profile.full_name,
        email: profile.email,
        dateOfBirth: profile.date_of_birth,
      },
      sessionToken,
      expiresAt,
    };
  });
}

export async function createCustomerSession(phoneE164: string, client?: PoolClient) {
  const sessionToken = randomToken();
  const expiresAt = new Date(Date.now() + env.CUSTOMER_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const statement = `INSERT INTO customer_sessions (phone_e164, token_hash, expires_at)
    VALUES ($1, $2, $3) RETURNING session_id`;
  const parameters = [phoneE164, sha256(sessionToken), expiresAt];
  const result = client
    ? await client.query<{ session_id: string }>(statement, parameters)
    : await query<{ session_id: string }>(statement, parameters);
  return { sessionId: result.rows[0]!.session_id, sessionToken, expiresAt };
}

export async function getCustomerDisplayProfile(phoneE164: string) {
  const result = await query<{
    phone_e164: string;
    full_name: string;
    email: string;
    date_of_birth: string | null;
  }>(
    `SELECT subject.phone_e164,
            coalesce(portal.full_name, admin_record.display_name) AS full_name,
            coalesce(portal.email, admin_record.email, '') AS email,
            portal.date_of_birth
     FROM customer_subjects subject
     LEFT JOIN portal_customer_profiles portal ON portal.phone_e164 = subject.phone_e164
     LEFT JOIN admin_customer_records admin_record
       ON admin_record.phone_e164 = subject.phone_e164 AND admin_record.record_status = 'ACTIVE'
     WHERE subject.phone_e164 = $1
       AND subject.status = 'ACTIVE'
       AND (portal.phone_e164 IS NOT NULL OR admin_record.phone_e164 IS NOT NULL)
     LIMIT 1`,
    [phoneE164],
  );
  const profile = result.rows[0];
  if (!profile) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'No customer exists for this mobile number.');
  return {
    phoneE164: profile.phone_e164,
    phone: nationalPhone(profile.phone_e164),
    name: profile.full_name,
    email: profile.email,
    dateOfBirth: profile.date_of_birth,
  };
}

export async function createDummyCustomerLogin(phoneInput: string) {
  const phoneE164 = normalizeIndianPhone(phoneInput);
  const profile = await getCustomerDisplayProfile(phoneE164);
  await query(
    `INSERT INTO customer_auth (phone_e164, auth_status)
     VALUES ($1, 'PENDING') ON CONFLICT (phone_e164) DO NOTHING`,
    [phoneE164],
  );
  const session = await createCustomerSession(phoneE164);
  return { profile, ...session };
}

export async function ensureRewardAccount(client: PoolClient, phoneE164: string): Promise<void> {
  await client.query(
    `INSERT INTO reward_accounts (phone_e164) VALUES ($1) ON CONFLICT (phone_e164) DO NOTHING`,
    [phoneE164],
  );
  await client.query(
    `INSERT INTO customer_reward_balances (phone_e164) VALUES ($1) ON CONFLICT (phone_e164) DO NOTHING`,
    [phoneE164],
  );
}

export async function getAdminOverview() {
  const result = await query<{
    total_customers: number;
    total_bookings: number;
    total_points_earned: number;
    total_points_redeemed: number;
  }>(
    `SELECT
      (SELECT count(*)::integer FROM admin_customer_records WHERE record_status = 'ACTIVE') AS total_customers,
      (SELECT count(*)::integer FROM bookings WHERE booking_status IN ('PENDING','CONFIRMED','COMPLETED')) AS total_bookings,
      coalesce((SELECT sum(total_points_earned)::integer FROM customer_reward_balances), 0) AS total_points_earned,
      coalesce((SELECT sum(total_points_redeemed)::integer FROM customer_reward_balances), 0) AS total_points_redeemed`,
  );
  const row = result.rows[0]!;
  return {
    totalCustomers: Number(row.total_customers),
    totalBookings: Number(row.total_bookings),
    totalPointsEarned: Number(row.total_points_earned),
    totalPointsRedeemed: Number(row.total_points_redeemed),
  };
}
