import { PoolClient } from 'pg';
import { query, withTransaction } from '../database/postgres';
import { supabaseAdmin } from '../database/supabase';
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

export interface CustomerDeletionRequestRow {
  request_id: string;
  phone_e164: string;
  customer_name: string;
  reason: string;
  request_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  requested_at: Date;
  reviewed_at: Date | null;
}

export async function ensureCustomerDeletionRequestsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS customer_deletion_requests (
      request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_e164 phone_e164 NOT NULL,
      customer_name varchar(150) NOT NULL,
      reason text NOT NULL,
      request_status varchar(12) NOT NULL DEFAULT 'PENDING' CHECK (request_status IN ('PENDING', 'APPROVED', 'REJECTED')),
      requested_by varchar(100) NOT NULL,
      reviewed_by varchar(100),
      review_note text,
      requested_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz
    );
  `);
}

export async function requestCustomerDeletion(input: {
  phone: string;
  reason: string;
  confirmCode: string;
  audit: AuditContext;
}) {
  await ensureCustomerDeletionRequestsTable();
  if (input.confirmCode !== 'confirm_delete') {
    throw new ApiError(400, 'INVALID_CONFIRM_CODE', 'Confirmation code must match exact string "confirm_delete".');
  }
  const phoneE164 = normalizeIndianPhone(input.phone);
  const trimmedReason = input.reason.trim();
  if (trimmedReason.length < 3) {
    throw new ApiError(400, 'INVALID_REASON', 'Please enter a valid reason for deletion (at least 3 characters).');
  }

  const customerResult = await query<{ display_name: string }>(
    `SELECT display_name FROM admin_customer_records WHERE phone_e164 = $1 AND record_status = 'ACTIVE' LIMIT 1`,
    [phoneE164],
  );
  const customer = customerResult.rows[0];
  if (!customer) {
    throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found.');
  }

  const result = await query<{ request_id: string }>(
    `INSERT INTO customer_deletion_requests (
       phone_e164, customer_name, reason, requested_by
     ) VALUES ($1, $2, $3, $4)
     RETURNING request_id`,
    [phoneE164, customer.display_name, trimmedReason, input.audit.adminUsername],
  );

  return {
    requestId: result.rows[0]!.request_id,
    message: 'Deletion request submitted for Super Admin approval.',
  };
}

export async function listPendingCustomerDeletionRequests() {
  await ensureCustomerDeletionRequestsTable();
  const result = await query<CustomerDeletionRequestRow>(
    `SELECT * FROM customer_deletion_requests
     WHERE request_status = 'PENDING'
     ORDER BY requested_at DESC`,
  );
  return result.rows.map((row) => ({
    id: row.request_id,
    phoneE164: row.phone_e164,
    customerName: row.customer_name,
    reason: row.reason,
    status: row.request_status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
  }));
}

export async function listSuperAdminCustomerDeletionRequests(status = 'PENDING') {
  await ensureCustomerDeletionRequestsTable();
  const statement = `
    SELECT * FROM customer_deletion_requests
    WHERE ($1 = 'ALL' OR request_status = $1)
    ORDER BY requested_at DESC
  `;
  const result = await query<CustomerDeletionRequestRow>(statement, [status]);

  return result.rows.map((row) => ({
    id: row.request_id,
    phoneE164: row.phone_e164,
    customerName: row.customer_name,
    reason: row.reason,
    status: row.request_status,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
  }));
}

export async function reviewCustomerDeletionRequest(input: {
  requestId: string;
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
  superAdminUsername: string;
  audit: AuditContext;
}) {
  await ensureCustomerDeletionRequestsTable();
  return withTransaction(async (client) => {
    const requestResult = await client.query<CustomerDeletionRequestRow>(
      `SELECT * FROM customer_deletion_requests WHERE request_id = $1 AND request_status = 'PENDING' FOR UPDATE`,
      [input.requestId],
    );
    const req = requestResult.rows[0];
    if (!req) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Customer deletion request not found or already reviewed.');
    }

    if (input.decision === 'REJECT') {
      await client.query(
        `UPDATE customer_deletion_requests
         SET request_status = 'REJECTED', reviewed_by = $1, reviewed_at = now(), review_note = $2
         WHERE request_id = $3`,
        [input.superAdminUsername, input.reviewNote || null, input.requestId],
      );
      await writeAdminAudit(client, {
        ...input.audit,
        action: 'CUSTOMER_DELETION_REJECTED',
        entityType: 'CUSTOMER_DELETION_REQUEST',
        entityId: input.requestId,
      });
      return { success: true, message: 'Customer deletion request rejected.' };
    }

    // APPROVE -> Hard Cascade Deletion across all tables for customer identity
    // Copy the request details before deleting the request record to avoid foreign key issues
    const requestId = input.requestId;
    const phoneE164 = req.phone_e164;
    const customerName = req.customer_name;

    // Log the deletion of the request (for audit)
    await writeAdminAudit(client, {
      ...input.audit,
      action: 'CUSTOMER_DELETION_REQUEST_DELETED',
      entityType: 'CUSTOMER_DELETION_REQUEST',
      entityId: requestId,
    });

    // Delete the deletion request record to remove the foreign key obstacle
    await client.query(
      `DELETE FROM customer_deletion_requests WHERE request_id = $1`,
      [requestId]
    );

    try {
      console.log(`[Delete Cascade] Starting hard purge for phone: ${phoneE164}`);

      // 1. Purge reward_redemption_requests, reward_adjustment_requests, reward_change_requests
      console.log('[Delete Cascade] Purging reward redemption requests...');
      await client.query(
        `DELETE FROM reward_redemption_requests
         WHERE phone_e164 = $1
            OR ledger_entry_id IN (SELECT entry_id FROM reward_ledger WHERE phone_e164 = $1)`,
        [phoneE164],
      );

      console.log('[Delete Cascade] Purging reward adjustment requests...');
      await client.query(
        `DELETE FROM reward_adjustment_requests
         WHERE phone_e164 = $1
            OR ledger_entry_id IN (SELECT entry_id FROM reward_ledger WHERE phone_e164 = $1)`,
        [phoneE164],
      );

      console.log('[Delete Cascade] Checking reward change requests...');
      await client.query(
        `DELETE FROM reward_change_requests WHERE requested_by = $1`,
        [phoneE164],
      );

      // 2. Reward ledger — NULL reversal_of self-references FIRST, then DELETE
      console.log('[Delete Cascade] Nulling reward_ledger reversal_of self-references...');
      await client.query(
        `UPDATE reward_ledger
         SET reversal_of = NULL
         WHERE phone_e164 = $1
            OR reversal_of IN (SELECT entry_id FROM reward_ledger WHERE phone_e164 = $1)`,
        [phoneE164],
      );

      console.log('[Delete Cascade] Purging reward ledger entries...');
      await client.query(
        `DELETE FROM reward_ledger
         WHERE phone_e164 = $1
            OR booking_id IN (SELECT booking_id FROM bookings WHERE phone_e164 = $1)`,
        [phoneE164],
      );

      // 3. Customer reward balances & reward accounts
      console.log('[Delete Cascade] Purging customer reward balances...');
      await client.query(`DELETE FROM customer_reward_balances WHERE phone_e164 = $1`, [phoneE164]);

      console.log('[Delete Cascade] Purging reward accounts...');
      await client.query(`DELETE FROM reward_accounts WHERE phone_e164 = $1`, [phoneE164]);

      // 3.5. Customer dashboard summary
      console.log('[Delete Cascade] Purging customer dashboard summary...');
      await client.query(`DELETE FROM customer_dashboard_summary WHERE phone_e164 = $1`, [phoneE164]);

      // 4. Booking events & bookings
      console.log('[Delete Cascade] Purging booking events...');
      await client.query(
        `DELETE FROM booking_events
         WHERE phone_e164 = $1
            OR booking_id IN (SELECT booking_id FROM bookings WHERE phone_e164 = $1)`,
        [phoneE164],
      );

      console.log('[Delete Cascade] Purging bookings...');
      await client.query(`DELETE FROM bookings WHERE phone_e164 = $1`, [phoneE164]);

      // 5. Customer auth & sessions
      console.log('[Delete Cascade] Purging customer sessions...');
      await client.query(`DELETE FROM customer_sessions WHERE phone_e164 = $1`, [phoneE164]);

      console.log('[Delete Cascade] Purging customer auth...');
      await client.query(`DELETE FROM customer_auth WHERE phone_e164 = $1`, [phoneE164]);

      // 6. Profiles & customer records
      console.log('[Delete Cascade] Purging portal customer profiles...');
      await client.query(`DELETE FROM portal_customer_profiles WHERE phone_e164 = $1`, [phoneE164]);

      console.log('[Delete Cascade] Purging admin customer records...');
      await client.query(`DELETE FROM admin_customer_records WHERE phone_e164 = $1`, [phoneE164]);

      // 7. Domain events & audit logs
      console.log('[Delete Cascade] Purging domain events...');
      await client.query(`DELETE FROM domain_events WHERE phone_e164 = $1`, [phoneE164]);

      console.log('[Delete Cascade] Purging admin audit logs for this customer...');
      await client.query(
        `DELETE FROM admin_audit_logs WHERE entity_id = $1 OR request_id = $1`,
        [phoneE164],
      );

      // 8. Root identity anchor — MUST BE LAST
      console.log('[Delete Cascade] Purging customer_subjects root record...');
      await client.query(`DELETE FROM customer_subjects WHERE phone_e164 = $1`, [phoneE164]);

      console.log(`[Delete Cascade] Database hard purge completed for: ${phoneE164}`);

      // 9. Safe Supabase Auth User Cleanup
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const authUser = usersData?.users?.find(u => u.phone === phoneE164 || u.user_metadata?.phone_e164 === phoneE164);
        if (authUser?.id) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.id);
          console.log(`[Delete Cascade] Supabase Auth user ${authUser.id} deleted.`);
        }
      } catch (supabaseAuthErr) {
        console.warn('[Delete Cascade Warning] Supabase Auth cleanup non-fatal warning:', supabaseAuthErr);
      }

      await writeAdminAudit(client, {
        ...input.audit,
        action: 'CUSTOMER_HARD_DELETED',
        entityType: 'CUSTOMER_SUBJECT',
        entityId: phoneE164,
        // Optionally, we can add the requestId and customerName to the audit log afterData
        // but the audit service might not support extra fields. We'll keep it as is.
      });

      return { success: true, message: `Customer ${customerName} (${phoneE164}) hard deleted permanently.` };
    } catch (cascadeErr: any) {
      console.error('[Delete Cascade Error Details]', {
        message: cascadeErr?.message,
        table: cascadeErr?.table,
        detail: cascadeErr?.detail,
        constraint: cascadeErr?.constraint,
        code: cascadeErr?.code,
      });
      throw cascadeErr;
    }
  });
}
