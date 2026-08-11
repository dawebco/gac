import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { query, withTransaction } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import type { AuditContext } from './customer.service';
import { writeAdminAudit } from './audit.service';

export async function adjustRewardPoints(input: {
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
      'SELECT available_points FROM customer_reward_balances WHERE phone_e164 = $1 FOR UPDATE',
      [input.phoneE164],
    );
    const previousBalance = Number(balanceResult.rows[0]?.available_points ?? 0);
    if (input.direction === 'REMOVE' && input.points > previousBalance) {
      throw new ApiError(409, 'INSUFFICIENT_REWARD_BALANCE', 'Points to remove cannot exceed the available balance.');
    }

    const delta = input.direction === 'ADD' ? input.points : -input.points;
    const entryType = input.direction === 'ADD' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT';
    const ledgerResult = await client.query<{ entry_id: string; created_at: Date }>(
      `INSERT INTO reward_ledger (
        phone_e164, entry_type, points_delta, reason, source, idempotency_key, created_by
      ) VALUES ($1, $2, $3, $4, 'ADMIN', $5, $6)
      RETURNING entry_id, created_at`,
      [input.phoneE164, entryType, delta, input.reason, `admin-adjustment:${input.idempotencyKey ?? randomUUID()}`, input.adminUsername],
    );
    await writeAdminAudit(client, {
      ...input.audit,
      action: entryType,
      entityType: 'REWARD_ACCOUNT',
      entityId: input.phoneE164,
      beforeData: { availablePoints: previousBalance },
      afterData: { availablePoints: previousBalance + delta, delta },
      reason: input.reason,
    });
    return {
      entryId: ledgerResult.rows[0]!.entry_id,
      pointsDelta: delta,
      availablePoints: previousBalance + delta,
      createdAt: ledgerResult.rows[0]!.created_at,
    };
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
