import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { query, withTransaction } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import type { AuditContext } from './customer.service';
import { writeAdminAudit } from './audit.service';

type RewardRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type RewardRequestRow = {
  request_id: string;
  phone_e164: string;
  display_name: string;
  direction: 'ADD' | 'REMOVE';
  points: number;
  reason: string;
  current_points_at_request: number;
  current_points: number;
  request_status: RewardRequestStatus;
  requested_by: string;
  requested_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  ledger_entry_id: string | null;
};

function mapRewardRequest(row: RewardRequestRow) {
  return {
    id: row.request_id,
    phoneE164: row.phone_e164,
    customerName: row.display_name,
    direction: row.direction,
    points: Number(row.points),
    reason: row.reason,
    pointsAtRequest: Number(row.current_points_at_request),
    currentPoints: Number(row.current_points),
    status: row.request_status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    ledgerEntryId: row.ledger_entry_id,
  };
}

const rewardRequestSelect = `
  SELECT request.request_id, request.phone_e164, customer.display_name,
         request.direction, request.points, request.reason, request.current_points_at_request,
         COALESCE(balance.available_points, 0)::integer AS current_points,
         request.request_status, request.requested_by, request.requested_at,
         request.reviewed_by, request.reviewed_at, request.review_note, request.ledger_entry_id
  FROM reward_adjustment_requests AS request
  JOIN admin_customer_records AS customer ON customer.phone_e164 = request.phone_e164
  LEFT JOIN customer_reward_balances AS balance ON balance.phone_e164 = request.phone_e164`;

export async function requestRewardAdjustment(input: {
  phoneE164: string;
  direction: 'ADD' | 'REMOVE';
  points: number;
  reason: string;
  adminUsername: string;
  idempotencyKey?: string;
  audit: AuditContext;
}, transactionClient?: PoolClient) {
  const operation = async (client: PoolClient) => {
    const customer = await client.query(
      `SELECT 1 FROM admin_customer_records WHERE phone_e164 = $1 AND record_status = 'ACTIVE'`,
      [input.phoneE164],
    );
    if (!customer.rowCount) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found.');

    const balanceResult = await client.query<{ available_points: number }>(
      'SELECT available_points FROM customer_reward_balances WHERE phone_e164 = $1',
      [input.phoneE164],
    );
    const previousBalance = Number(balanceResult.rows[0]?.available_points ?? 0);
    if (input.direction === 'REMOVE' && input.points > previousBalance) {
      throw new ApiError(409, 'INSUFFICIENT_REWARD_BALANCE', 'Points to remove cannot exceed the available balance.');
    }

    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const requestResult = await client.query<{ request_id: string; requested_at: Date }>(
      `INSERT INTO reward_adjustment_requests (
        phone_e164, direction, points, reason, current_points_at_request, requested_by, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING request_id, requested_at`,
      [input.phoneE164, input.direction, input.points, input.reason, previousBalance, input.adminUsername, idempotencyKey],
    );
    await writeAdminAudit(client, {
      ...input.audit,
      action: 'REWARD_ADJUSTMENT_REQUESTED',
      entityType: 'REWARD_ADJUSTMENT_REQUEST',
      entityId: requestResult.rows[0]!.request_id,
      beforeData: { availablePoints: previousBalance },
      afterData: { direction: input.direction, points: input.points, status: 'PENDING' },
      reason: input.reason,
    });
    return {
      requestId: requestResult.rows[0]!.request_id,
      status: 'PENDING' as const,
      direction: input.direction,
      points: input.points,
      availablePoints: previousBalance,
      requestedAt: requestResult.rows[0]!.requested_at,
    };
  };
  return transactionClient ? operation(transactionClient) : withTransaction(operation);
}

export async function listRewardAdjustmentRequests(status: RewardRequestStatus | 'ALL' = 'PENDING') {
  const where = status === 'ALL' ? '' : 'WHERE request.request_status = $1';
  const values = status === 'ALL' ? [] : [status];
  const result = await query<RewardRequestRow>(
    `${rewardRequestSelect} ${where} ORDER BY request.requested_at DESC LIMIT 500`,
    values,
  );
  return result.rows.map(mapRewardRequest);
}

export async function reviewRewardAdjustmentRequest(input: {
  requestId: string;
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
  superAdminUsername: string;
  audit: AuditContext;
}, transactionClient?: PoolClient) {
  const operation = async (client: PoolClient) => {
    const requestResult = await client.query<{
      request_id: string; phone_e164: string; direction: 'ADD' | 'REMOVE'; points: number;
      reason: string; request_status: RewardRequestStatus; requested_by: string;
    }>(
      `SELECT request_id, phone_e164, direction, points, reason, request_status, requested_by
       FROM reward_adjustment_requests WHERE request_id = $1 FOR UPDATE`,
      [input.requestId],
    );
    const request = requestResult.rows[0];
    if (!request) throw new ApiError(404, 'REWARD_REQUEST_NOT_FOUND', 'Reward adjustment request not found.');
    if (request.request_status !== 'PENDING') {
      throw new ApiError(409, 'REWARD_REQUEST_ALREADY_REVIEWED', 'This reward request has already been reviewed.');
    }

    let ledgerEntryId: string | null = null;
    let availablePoints: number;
    const balanceResult = await client.query<{ available_points: number }>(
      'SELECT available_points FROM customer_reward_balances WHERE phone_e164 = $1 FOR UPDATE',
      [request.phone_e164],
    );
    const previousBalance = Number(balanceResult.rows[0]?.available_points ?? 0);
    availablePoints = previousBalance;

    if (input.decision === 'APPROVE') {
      if (request.direction === 'REMOVE' && request.points > previousBalance) {
        throw new ApiError(409, 'INSUFFICIENT_REWARD_BALANCE', 'This customer no longer has enough points for the requested deduction.');
      }
      const delta = request.direction === 'ADD' ? request.points : -request.points;
      const entryType = request.direction === 'ADD' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT';
      const ledgerResult = await client.query<{ entry_id: string }>(
        `INSERT INTO reward_ledger (
          phone_e164, entry_type, points_delta, reason, source, idempotency_key, created_by
        ) VALUES ($1, $2, $3, $4, 'ADMIN', $5, $6) RETURNING entry_id`,
        [request.phone_e164, entryType, delta, request.reason, `reward-request:${request.request_id}`, input.superAdminUsername],
      );
      ledgerEntryId = ledgerResult.rows[0]!.entry_id;
      availablePoints = previousBalance + delta;
    }

    const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await client.query(
      `UPDATE reward_adjustment_requests
       SET request_status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4, ledger_entry_id = $5
       WHERE request_id = $1`,
      [request.request_id, status, input.superAdminUsername, input.reviewNote ?? null, ledgerEntryId],
    );
    await writeAdminAudit(client, {
      ...input.audit,
      action: `REWARD_ADJUSTMENT_${status}`,
      entityType: 'REWARD_ADJUSTMENT_REQUEST',
      entityId: request.request_id,
      beforeData: { status: 'PENDING', availablePoints: previousBalance },
      afterData: { status, availablePoints, ledgerEntryId },
      reason: input.reviewNote || request.reason,
    });

    const result = await client.query<RewardRequestRow>(
      `${rewardRequestSelect} WHERE request.request_id = $1`,
      [request.request_id],
    );
    return mapRewardRequest(result.rows[0]!);
  };
  return transactionClient ? operation(transactionClient) : withTransaction(operation);
}

export async function getUnifiedDashboard(phoneE164: string) {
  const result = await query<{
    phone_e164: string;
    total_bookings: number;
    available_points: number;
    total_points_earned: number;
    total_points_redeemed: number;
    balance_version: number;
    updated_at: Date;
  }>(
    `SELECT phone_e164, total_bookings, available_points, total_points_earned,
            total_points_redeemed, balance_version, updated_at
     FROM customer_dashboard_summary WHERE phone_e164 = $1`,
    [phoneE164],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer identity not found.');
  return {
    phoneE164: row.phone_e164,
    totalBookings: Number(row.total_bookings),
    availablePoints: Number(row.available_points),
    totalPointsEarned: Number(row.total_points_earned),
    totalPointsRedeemed: Number(row.total_points_redeemed),
    balanceVersion: Number(row.balance_version),
    updatedAt: row.updated_at,
  };
}
