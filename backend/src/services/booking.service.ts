import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { query, withTransaction } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import { writeAdminAudit } from './audit.service';
import type { AuditContext } from './customer.service';

export type BookingType = 'FLIGHTS' | 'HOTELS' | 'HOLIDAYS';

export interface CreateBookingInput {
  phoneE164: string;
  bookingType: BookingType;
  purchasedAmount: number;
  bookingDate: string;
  adminUsername: string;
  idempotencyKey: string;
  audit: AuditContext;
}

export async function createBookingInTransaction(client: PoolClient, input: CreateBookingInput) {
  const customer = await client.query(
    `SELECT 1 FROM admin_customer_records WHERE phone_e164 = $1 AND record_status = 'ACTIVE'`,
    [input.phoneE164],
  );
  if (!customer.rowCount) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found.');

  const ruleResult = await client.query<{ reward_rule_id: string; rupees_per_point: string }>(
    `SELECT reward_rule_id, rupees_per_point
     FROM reward_rules
     WHERE booking_type = $1 AND is_active = true
       AND effective_from <= $2::timestamptz
       AND (effective_to IS NULL OR effective_to > $2::timestamptz)
     ORDER BY effective_from DESC LIMIT 1 FOR SHARE`,
    [input.bookingType, input.bookingDate],
  );
  const rule = ruleResult.rows[0];
  if (!rule) throw new ApiError(409, 'REWARD_RULE_MISSING', 'No active reward rule exists for this booking type and date.');

  const pointsAwarded = Math.floor(input.purchasedAmount / Number(rule.rupees_per_point));
  const bookingReference = `GAC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const bookingResult = await client.query<{
    booking_id: string;
    booking_reference: string;
    booking_type: BookingType;
    purchased_amount: string;
    points_awarded: number;
    booking_status: string;
    booking_date: Date;
  }>(
    `INSERT INTO bookings (
      booking_reference, phone_e164, reward_rule_id, booking_type, purchased_amount,
      points_awarded, booking_status, booking_date, created_source, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, 'ADMIN', $8)
    RETURNING booking_id, booking_reference, booking_type, purchased_amount,
              points_awarded, booking_status, booking_date`,
    [bookingReference, input.phoneE164, rule.reward_rule_id, input.bookingType, input.purchasedAmount, pointsAwarded, input.bookingDate, input.adminUsername],
  );
  const booking = bookingResult.rows[0]!;

  await client.query(
    `INSERT INTO booking_events (booking_id, phone_e164, event_type, after_data, performed_by)
     VALUES ($1, $2, 'CREATED', $3::jsonb, $4)`,
    [booking.booking_id, input.phoneE164, JSON.stringify(booking), input.adminUsername],
  );

  if (pointsAwarded > 0) {
    await client.query(
      `INSERT INTO reward_ledger (
        phone_e164, booking_id, entry_type, points_delta, reason, source,
        idempotency_key, created_by
      ) VALUES ($1, $2, 'BOOKING_EARN', $3, $4, 'BOOKING', $5, $6)`,
      [input.phoneE164, booking.booking_id, pointsAwarded, `Points earned for booking ${bookingReference}`, `booking-earn:${input.idempotencyKey}`, input.adminUsername],
    );
  }

  await writeAdminAudit(client, {
    ...input.audit,
    action: 'BOOKING_CREATED',
    entityType: 'BOOKING',
    entityId: booking.booking_id,
    afterData: booking,
  });
  await client.query(
    `INSERT INTO domain_events (aggregate_type, aggregate_id, phone_e164, event_type, payload)
     VALUES ('BOOKING', $1, $2, 'BOOKING_CREATED', $3::jsonb)`,
    [booking.booking_id, input.phoneE164, JSON.stringify({ bookingId: booking.booking_id, pointsAwarded })],
  );

  return mapBooking(booking);
}

export async function createBooking(input: CreateBookingInput) {
  return withTransaction((client) => createBookingInTransaction(client, input));
}

export async function listBookings(phoneE164: string) {
  const result = await query<{
    booking_id: string;
    booking_reference: string;
    booking_type: BookingType;
    purchased_amount: string;
    points_awarded: number;
    booking_status: string;
    booking_date: Date;
  }>(
    `SELECT booking_id, booking_reference, booking_type, purchased_amount,
            points_awarded, booking_status, booking_date
     FROM bookings WHERE phone_e164 = $1 ORDER BY booking_date DESC, created_at DESC`,
    [phoneE164],
  );
  return result.rows.map(mapBooking);
}

export async function voidBooking(input: {
  phoneE164: string;
  bookingId: string;
  reason: string;
  adminUsername: string;
  audit: AuditContext;
}, transactionClient?: PoolClient) {
  const operation = async (client: PoolClient) => {
    const bookingResult = await client.query<{
      booking_id: string;
      booking_reference: string;
      booking_type: BookingType;
      purchased_amount: string;
      points_awarded: number;
      booking_status: string;
      booking_date: Date;
    }>(
      `SELECT booking_id, booking_reference, booking_type, purchased_amount,
              points_awarded, booking_status, booking_date
       FROM bookings WHERE booking_id = $1 AND phone_e164 = $2 FOR UPDATE`,
      [input.bookingId, input.phoneE164],
    );
    const before = bookingResult.rows[0];
    if (!before) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found for this customer.');
    if (before.booking_status === 'VOIDED') return mapBooking(before);

    const earnResult = await client.query<{ entry_id: string; points_delta: number }>(
      `SELECT entry_id, points_delta FROM reward_ledger
       WHERE booking_id = $1 AND entry_type = 'BOOKING_EARN' LIMIT 1`,
      [input.bookingId],
    );
    const earnEntry = earnResult.rows[0];
    if (earnEntry) {
      const balanceResult = await client.query<{ available_points: number }>(
        'SELECT available_points FROM customer_reward_balances WHERE phone_e164 = $1 FOR UPDATE',
        [input.phoneE164],
      );
      if (Number(balanceResult.rows[0]?.available_points ?? 0) < Number(earnEntry.points_delta)) {
        throw new ApiError(409, 'BOOKING_POINTS_ALREADY_USED', 'This booking cannot be deleted because some of its awarded points have already been used.');
      }
      await client.query(
        `INSERT INTO reward_ledger (
          phone_e164, booking_id, entry_type, points_delta, reason, source,
          idempotency_key, reversal_of, created_by
        ) VALUES ($1, $2, 'BOOKING_REVERSAL', $3, $4, 'BOOKING', $5, $6, $7)`,
        [input.phoneE164, input.bookingId, -Number(earnEntry.points_delta), input.reason, `booking-reversal:${input.bookingId}`, earnEntry.entry_id, input.adminUsername],
      );
    }

    const updatedResult = await client.query<typeof before>(
      `UPDATE bookings SET booking_status = 'VOIDED', deletion_reason = $1,
         deleted_by = $2, deleted_at = now(), record_version = record_version + 1
       WHERE booking_id = $3
       RETURNING booking_id, booking_reference, booking_type, purchased_amount,
                 points_awarded, booking_status, booking_date`,
      [input.reason, input.adminUsername, input.bookingId],
    );
    const updated = updatedResult.rows[0]!;
    await client.query(
      `INSERT INTO booking_events (booking_id, phone_e164, event_type, before_data, after_data, reason, performed_by)
       VALUES ($1, $2, 'VOIDED', $3::jsonb, $4::jsonb, $5, $6)`,
      [input.bookingId, input.phoneE164, JSON.stringify(before), JSON.stringify(updated), input.reason, input.adminUsername],
    );
    await writeAdminAudit(client, {
      ...input.audit,
      action: 'BOOKING_VOIDED', entityType: 'BOOKING', entityId: input.bookingId,
      beforeData: before, afterData: updated, reason: input.reason,
    });
    return mapBooking(updated);
  };
  return transactionClient ? operation(transactionClient) : withTransaction(operation);
}

function mapBooking(row: {
  booking_id: string;
  booking_reference: string;
  booking_type: BookingType;
  purchased_amount: string;
  points_awarded: number;
  booking_status: string;
  booking_date: Date;
}) {
  return {
    id: row.booking_id,
    reference: row.booking_reference,
    type: row.booking_type,
    amount: Number(row.purchased_amount),
    rewardPoints: Number(row.points_awarded),
    status: row.booking_status,
    date: new Date(row.booking_date).toISOString().slice(0, 10),
  };
}
