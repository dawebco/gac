import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { query, withTransaction } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import type { AuditContext } from './customer.service';
import { writeAdminAudit } from './audit.service';

interface RewardCatalogRow {
  reward_id: string;
  points_required: number;
  title: string;
}

interface RewardBalanceRow {
  available_points: number;
}

interface RedemptionRequestRow {
  request_id: string;
  phone_e164: string;
  reward_id: string;
  points_at_request: number;
}

async function createRedemptionLedgerEntry(client: PoolClient, input: {
  phone: string;
  points: number;
  reason: string;
  adminUsername: string;
}) {
  const result = await client.query<{ entry_id: string }>(
    `INSERT INTO reward_ledger (phone_e164, entry_type, points_delta, reason, source, idempotency_key, created_by)
     VALUES ($1, 'REDEMPTION', $2, $3, 'CUSTOMER', $4, $5)
     RETURNING entry_id`,
    [input.phone, -Math.abs(input.points), input.reason, randomUUID(), input.adminUsername],
  );
  return result.rows[0]!.entry_id;
}

export async function requestRedemption(input: {
  phone: string;
  rewardId: string;
  idempotencyKey: string;
}) {
  return withTransaction(async (client) => {
    const rewardResult = await client.query<RewardCatalogRow>(
      'SELECT reward_id, points_required, title FROM reward_catalog WHERE reward_id = $1 AND is_active = true FOR SHARE',
      [input.rewardId],
    );
    const reward = rewardResult.rows[0];
    if (!reward) {
      throw new ApiError(404, 'REWARD_NOT_FOUND', 'The selected reward is not available.');
    }

    const balanceResult = await client.query<RewardBalanceRow>(
      'SELECT available_points FROM customer_reward_balances WHERE phone_e164 = $1 FOR UPDATE',
      [input.phone],
    );
    const balance = balanceResult.rows[0];
    if (!balance || balance.available_points < reward.points_required) {
      throw new ApiError(400, 'INSUFFICIENT_POINTS', 'You do not have enough points to redeem this reward.');
    }

    const existingRequestResult = await client.query(
      "SELECT 1 FROM reward_redemption_requests WHERE phone_e164 = $1 AND reward_id = $2 AND request_status = 'PENDING'",
      [input.phone, input.rewardId],
    );
    if ((existingRequestResult.rowCount ?? 0) > 0) {
      throw new ApiError(409, 'DUPLICATE_REQUEST', 'You have already requested this reward.');
    }

    await client.query(
      `INSERT INTO reward_redemption_requests (phone_e164, reward_id, points_at_request, idempotency_key)
       VALUES ($1, $2, $3, $4)`,
      [input.phone, input.rewardId, reward.points_required, input.idempotencyKey],
    );
  });
}

interface PendingRequestRow {
  request_id: string;
  customer_name: string;
  phone_e164: string;
  reward_title: string;
  points_at_request: number;
}

/**
 * Retrieves a list of all redemption requests that are currently in a PENDING state.
 * This is used by the admin portal to display requests needing review.
 */
export async function listPendingRedemptionRequests() {
  const result = await query<PendingRequestRow>(`
    SELECT
      req.request_id,
      COALESCE(prof.full_name, rec.display_name, req.phone_e164) AS customer_name,
      req.phone_e164,
      cat.title AS reward_title,
      req.points_at_request
    FROM reward_redemption_requests AS req
    JOIN reward_catalog AS cat ON req.reward_id = cat.reward_id
    LEFT JOIN portal_customer_profiles AS prof ON req.phone_e164 = prof.phone_e164
    LEFT JOIN admin_customer_records AS rec ON req.phone_e164 = rec.phone_e164
    WHERE req.request_status = 'PENDING'
    ORDER BY req.requested_at ASC
  `);

  return result.rows.map(row => ({
    requestId: row.request_id,
    customerName: row.customer_name,
    phone: row.phone_e164.replace(/^\+91/, ''),
    rewardName: row.reward_title,
    points: Number(row.points_at_request),
  }));
}

export async function reviewRedemptionRequest(input: {
  requestId: string;
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
  audit: AuditContext;
}) {
  return withTransaction(async (client) => {
    const requestResult = await client.query<RedemptionRequestRow>(
      "SELECT request_id, phone_e164, reward_id, points_at_request FROM reward_redemption_requests WHERE request_id = $1 AND request_status = 'PENDING' FOR UPDATE",
      [input.requestId],
    );
    const request = requestResult.rows[0];
    if (!request) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'The redemption request was not found or has already been processed.');
    }

    if (input.decision === 'REJECT') {
      await client.query(
        `UPDATE reward_redemption_requests SET request_status = 'REJECTED', reviewed_by_admin = $1, reviewed_at = now(), review_note = $2 WHERE request_id = $3`,
        [input.audit.adminUsername, input.reviewNote, input.requestId],
      );
      await writeAdminAudit(client, { ...input.audit, action: 'REDEMPTION_REJECTED', entityType: 'REWARD_REDEMPTION', entityId: input.requestId });
      return { success: true, message: 'Request rejected.' };
    }

    // Handle APPROVE
    const balanceResult = await client.query<RewardBalanceRow>('SELECT available_points FROM customer_reward_balances WHERE phone_e164 = $1 FOR UPDATE', [request.phone_e164]);
    if (!balanceResult.rows[0] || balanceResult.rows[0].available_points < request.points_at_request) {
      await client.query(`UPDATE reward_redemption_requests SET request_status = 'REJECTED', reviewed_by_admin = 'SYSTEM', reviewed_at = now(), review_note = 'Auto-rejected due to insufficient points.' WHERE request_id = $1`, [input.requestId]);
      throw new ApiError(409, 'INSUFFICIENT_POINTS', 'Customer has insufficient points. The request has been automatically rejected.');
    }

    const rewardResult = await client.query<{ title: string }>('SELECT title FROM reward_catalog WHERE reward_id = $1', [request.reward_id]);
    const ledgerEntryId = await createRedemptionLedgerEntry(client, {
      phone: request.phone_e164,
      points: request.points_at_request,
      reason: `Redemption of reward: ${rewardResult.rows[0]?.title || 'Uknown Reward'}`,
      adminUsername: input.audit.adminUsername,
    });

    await client.query(`UPDATE reward_redemption_requests SET request_status = 'APPROVED', reviewed_by_admin = $1, reviewed_at = now(), review_note = $2, ledger_entry_id = $3 WHERE request_id = $4`, [input.audit.adminUsername, input.reviewNote, ledgerEntryId, input.requestId]);
    await writeAdminAudit(client, { ...input.audit, action: 'REDEMPTION_APPROVED', entityType: 'REWARD_REDEMPTION', entityId: input.requestId });
    return { success: true, message: 'Request approved.' };
  });
}