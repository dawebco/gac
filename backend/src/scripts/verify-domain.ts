import { randomUUID } from 'node:crypto';
import { closePostgresPool, postgresPool } from '../database/postgres';
import { createBookingInTransaction, voidBooking } from '../services/booking.service';
import { adjustRewardPoints } from '../services/reward.service';

function assertEqual(actual: number | string, expected: number | string, label: string): void {
  if (actual !== expected) throw new Error(`${label}: received ${actual}; expected ${expected}`);
}

async function main(): Promise<void> {
  const client = await postgresPool.connect();
  const phoneE164 = '+919999999999';
  const audit = { adminUsername: 'verification', requestId: randomUUID() };

  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO customer_subjects (phone_e164) VALUES ($1)', [phoneE164]);
    await client.query(
      `INSERT INTO admin_customer_records (phone_e164, display_name, email, created_by)
       VALUES ($1, 'Rollback Verification', 'rollback-verification@example.com', 'verification')`,
      [phoneE164],
    );
    await client.query('INSERT INTO reward_accounts (phone_e164) VALUES ($1)', [phoneE164]);
    await client.query('INSERT INTO customer_reward_balances (phone_e164) VALUES ($1)', [phoneE164]);

    const booking = await createBookingInTransaction(client, {
      phoneE164,
      bookingType: 'HOTELS',
      purchasedAmount: 1000,
      bookingDate: new Date().toISOString().slice(0, 10),
      adminUsername: 'verification',
      idempotencyKey: randomUUID(),
      audit,
    });
    assertEqual(booking.rewardPoints, 1000, 'Hotel reward calculation');

    await adjustRewardPoints({
      phoneE164, direction: 'ADD', points: 200, reason: 'Rollback verification credit',
      adminUsername: 'verification', idempotencyKey: randomUUID(), audit,
    }, client);
    await adjustRewardPoints({
      phoneE164, direction: 'REMOVE', points: 50, reason: 'Rollback verification debit',
      adminUsername: 'verification', idempotencyKey: randomUUID(), audit,
    }, client);
    await voidBooking({
      phoneE164, bookingId: booking.id, reason: 'Rollback verification reversal',
      adminUsername: 'verification', audit,
    }, client);

    const summaryResult = await client.query<{
      total_bookings: number;
      available_points: number;
      total_points_earned: number;
      total_points_redeemed: number;
    }>('SELECT total_bookings, available_points, total_points_earned, total_points_redeemed FROM customer_dashboard_summary WHERE phone_e164 = $1', [phoneE164]);
    const summary = summaryResult.rows[0]!;
    assertEqual(Number(summary.total_bookings), 0, 'Voided booking count');
    assertEqual(Number(summary.available_points), 150, 'Unified available balance');
    assertEqual(Number(summary.total_points_earned), 200, 'Unified total points earned');
    assertEqual(Number(summary.total_points_redeemed), 0, 'Unified total points redeemed');

    console.log(JSON.stringify({
      bookingAward: 'verified',
      bookingVoidAndReversal: 'verified',
      manualCreditAndDebit: 'verified',
      unifiedDashboardSummary: 'verified',
      persistedVerificationData: false,
    }, null, 2));
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await closePostgresPool();
  }
}

main().catch((error: unknown) => {
  console.error(`Domain verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
