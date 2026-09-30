import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { query, withTransaction } from '../database/postgres';
import { ApiError } from '../shared/api-error';
import { nationalPhone } from '../shared/phone';
import { writeAdminAudit } from './audit.service';
import type { AuditContext } from './customer.service';
import { syncRewardThresholdNotifications } from './reward.service';

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
  const booking = await withTransaction((client) => createBookingInTransaction(client, input));
  try {
    const balanceResult = await query<{ available_points: number }>(
      'SELECT available_points FROM customer_reward_balances WHERE phone_e164 = $1',
      [input.phoneE164],
    );
    await syncRewardThresholdNotifications(input.phoneE164, Number(balanceResult.rows[0]?.available_points ?? 0));
  } catch (error) {
    console.error('Reward threshold notification failed after booking creation:', error);
  }
  return booking;
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

export interface BookingReportFilter {
  bookingType?: 'FLIGHTS' | 'HOTELS' | 'HOLIDAYS' | 'ALL' | string;
  startDate?: string;
  endDate?: string;
}

export interface BookingReportRow {
  phoneE164: string;
  phone: string;
  name: string;
  email: string;
  bookings: number;
  points: number;
  totalPurchasedAmount: number;
}

export interface BookingReportResult {
  summary: {
    totalCustomers: number;
    totalBookings: number;
    totalPoints: number;
    totalPurchasedAmount: number;
    bookingType: string;
    startDate?: string;
    endDate?: string;
  };
  rows: BookingReportRow[];
}

export async function getBookingReport(filters: BookingReportFilter): Promise<BookingReportResult> {
  const normalizedType = filters.bookingType && filters.bookingType !== 'ALL' && filters.bookingType !== 'All bookings'
    ? filters.bookingType.toUpperCase()
    : '';

  const result = await query<{
    phone_e164: string;
    display_name: string;
    email: string | null;
    bookings_count: number;
    points_earned: number;
    total_amount: string;
  }>(
    `SELECT 
       coalesce(record.phone_e164, b.phone_e164) AS phone_e164,
       coalesce(record.display_name, profile.full_name, 'Unknown') AS display_name,
       coalesce(record.email, profile.email, '') AS email,
       count(b.booking_id)::integer AS bookings_count,
       coalesce(sum(b.points_awarded), 0)::integer AS points_earned,
       coalesce(sum(b.purchased_amount), 0)::numeric AS total_amount
     FROM bookings b
     LEFT JOIN admin_customer_records record ON record.phone_e164 = b.phone_e164
     LEFT JOIN portal_customer_profiles profile ON profile.phone_e164 = b.phone_e164
     WHERE b.booking_status <> 'VOIDED'
       AND ($1 = '' OR b.booking_type = $1)
       AND ($2::date IS NULL OR b.booking_date >= $2::date)
       AND ($3::date IS NULL OR b.booking_date < ($3::date + INTERVAL '1 day'))
     GROUP BY coalesce(record.phone_e164, b.phone_e164), record.display_name, profile.full_name, record.email, profile.email
     ORDER BY bookings_count DESC, points_earned DESC, display_name ASC`,
    [normalizedType, filters.startDate || null, filters.endDate || null],
  );

  const rows: BookingReportRow[] = result.rows.map(row => ({
    phoneE164: row.phone_e164,
    phone: nationalPhone(row.phone_e164),
    name: row.display_name,
    email: row.email ?? '',
    bookings: Number(row.bookings_count),
    points: Number(row.points_earned),
    totalPurchasedAmount: Number(row.total_amount),
  }));

  const totalCustomers = rows.length;
  const totalBookings = rows.reduce((sum, r) => sum + r.bookings, 0);
  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
  const totalPurchasedAmount = rows.reduce((sum, r) => sum + r.totalPurchasedAmount, 0);

  return {
    summary: {
      totalCustomers,
      totalBookings,
      totalPoints,
      totalPurchasedAmount,
      bookingType: filters.bookingType || 'All bookings',
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    rows,
  };
}

