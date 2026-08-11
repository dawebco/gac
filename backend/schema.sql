-- GAC Holidays backend schema
-- Target: Supabase PostgreSQL
-- Execute this file once in the Supabase SQL editor or with psql.
-- WhatsApp OTP challenge storage is intentionally deferred to the OTP phase.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'phone_e164'
  ) THEN
    CREATE DOMAIN phone_e164 AS varchar(16)
      CHECK (VALUE ~ '^\+[1-9][0-9]{7,14}$');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS customer_subjects (
  phone_e164 phone_e164 PRIMARY KEY,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'BLOCKED', 'ARCHIVED')),
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE customer_subjects IS
  'Canonical phone-number identity anchor. This row alone does not represent portal registration.';

CREATE TABLE IF NOT EXISTS portal_customer_profiles (
  phone_e164 phone_e164 PRIMARY KEY
    REFERENCES customer_subjects(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  full_name varchar(150) NOT NULL CHECK (length(trim(full_name)) >= 2),
  email varchar(255) NOT NULL CHECK (email = lower(email)),
  date_of_birth date,
  profile_status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (profile_status IN ('ACTIVE', 'BLOCKED', 'CLOSED')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE portal_customer_profiles IS
  'Customer self-registration profile. Independent from admin_customer_records.';

CREATE TABLE IF NOT EXISTS admin_customer_records (
  phone_e164 phone_e164 PRIMARY KEY
    REFERENCES customer_subjects(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  display_name varchar(150) NOT NULL CHECK (length(trim(display_name)) >= 2),
  email varchar(255) CHECK (email IS NULL OR email = lower(email)),
  notes text,
  record_status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (record_status IN ('ACTIVE', 'ARCHIVED')),
  created_by varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_customer_records IS
  'Operational customer record created by an admin. Does not create portal access.';

CREATE TABLE IF NOT EXISTS customer_auth (
  phone_e164 phone_e164 PRIMARY KEY
    REFERENCES customer_subjects(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  auth_status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (auth_status IN ('PENDING', 'ACTIVE', 'LOCKED', 'DISABLED')),
  phone_verified_at timestamptz,
  last_login_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (auth_status <> 'ACTIVE' OR phone_verified_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 phone_e164 NOT NULL
    REFERENCES customer_auth(phone_e164)
    ON UPDATE CASCADE ON DELETE CASCADE,
  token_hash varchar(128) NOT NULL UNIQUE,
  user_agent text,
  ip_address_hash varchar(128),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_username varchar(100) NOT NULL,
  token_hash varchar(128) NOT NULL UNIQUE,
  csrf_token_hash varchar(128) NOT NULL,
  user_agent text,
  ip_address_hash varchar(128),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS reward_rules (
  reward_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type varchar(30) NOT NULL
    CHECK (booking_type IN ('FLIGHTS', 'HOTELS', 'HOLIDAYS')),
  rupees_per_point numeric(12,2) NOT NULL CHECK (rupees_per_point > 0),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  UNIQUE (booking_type, effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_rules_current_type
  ON reward_rules(booking_type)
  WHERE is_active = true AND effective_to IS NULL;

INSERT INTO reward_rules (
  booking_type,
  rupees_per_point,
  effective_from,
  created_by
)
VALUES
  ('FLIGHTS', 5, '2026-01-01 00:00:00+00', 'INITIAL_SCHEMA'),
  ('HOTELS', 1, '2026-01-01 00:00:00+00', 'INITIAL_SCHEMA'),
  ('HOLIDAYS', 1, '2026-01-01 00:00:00+00', 'INITIAL_SCHEMA')
ON CONFLICT (booking_type, effective_from) DO NOTHING;

CREATE TABLE IF NOT EXISTS reward_catalog (
  reward_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_code varchar(80) NOT NULL UNIQUE,
  category varchar(20) NOT NULL CHECK (category IN ('FEATURED', 'MILESTONE')),
  points_required integer NOT NULL CHECK (points_required > 0),
  title varchar(200) NOT NULL CHECK (length(trim(title)) >= 2),
  description text NOT NULL CHECK (length(trim(description)) >= 3),
  image_url text,
  image_storage_path text,
  valid_until date,
  display_order integer NOT NULL CHECK (display_order > 0),
  is_active boolean NOT NULL DEFAULT true,
  updated_by varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, display_order)
);

INSERT INTO reward_catalog (
  reward_code, category, points_required, title, description, valid_until, display_order
) VALUES
  ('FEATURED_BEACH_RESORT', 'FEATURED', 500, 'Beach Resort Voucher', '₹500 off on select beach resorts', '2026-12-31', 1),
  ('FEATURED_TRAVEL_KIT', 'FEATURED', 750, 'Free Travel Accessories Kit', 'Premium luggage and travel accessories', '2026-12-31', 2),
  ('FEATURED_INTERNATIONAL', 'FEATURED', 1000, '₹1000 off on International Packages', 'Exciting adventure sports experience', '2026-12-31', 3),
  ('MILESTONE_050000', 'MILESTONE', 50000, 'Travel & Plantation Experience', 'Complimentary travel pillow, travel kit, or spice plantation with lunch for 2 people.', NULL, 1),
  ('MILESTONE_100000', 'MILESTONE', 100000, 'Domestic Flight Comfort', 'Complimentary pre-booked meal and seat on your next domestic flight booking.', NULL, 2),
  ('MILESTONE_200000', 'MILESTONE', 200000, 'Goa Experience for Two', 'Watersports for 2 people or dinner cruise on the Mandovi River for 2 people.', NULL, 3),
  ('MILESTONE_300000', 'MILESTONE', 300000, 'Five-Star Brunch', 'Complimentary 5-star brunch for 2 people.', NULL, 4),
  ('MILESTONE_500000', 'MILESTONE', 500000, 'Travel Suitcase', 'American Tourister travel suitcase.', NULL, 5),
  ('MILESTONE_1000000', 'MILESTONE', 1000000, 'Premium Air Fryer', 'A premium air fryer selected by GAC Holidays.', NULL, 6),
  ('MILESTONE_1500000', 'MILESTONE', 1500000, 'Goa Hotel Stay', 'Complimentary 1-night stay for 2 people at a selected 4/5-star hotel in Goa.', NULL, 7),
  ('MILESTONE_2000000', 'MILESTONE', 2000000, 'India Stay or Smartphone', 'A 1-night hotel stay for 2 anywhere in India or a premium Android smartphone.', NULL, 8),
  ('MILESTONE_5000000', 'MILESTONE', 5000000, 'Premium Smart Television', 'A premium smart television selected at redemption.', NULL, 9),
  ('MILESTONE_7000000', 'MILESTONE', 7000000, 'Domestic Tour or Refrigerator', 'A complimentary domestic tour or premium refrigerator.', NULL, 10),
  ('MILESTONE_10000000', 'MILESTONE', 10000000, 'International Tour or AC', 'A complimentary international tour or premium air conditioner.', NULL, 11),
  ('MILESTONE_15000000', 'MILESTONE', 15000000, 'Apple iPhone 17', 'An Apple iPhone 17, subject to model and availability.', NULL, 12),
  ('MILESTONE_20000000', 'MILESTONE', 20000000, '5 Gram Gold Coin', 'A complimentary 5 gram gold coin.', NULL, 13)
ON CONFLICT (reward_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS packages (
  package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code varchar(50) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  description text,
  booking_type varchar(30) NOT NULL
    CHECK (booking_type IN ('FLIGHTS', 'HOTELS', 'HOLIDAYS')),
  base_price numeric(12,2) CHECK (base_price IS NULL OR base_price >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference varchar(50) NOT NULL UNIQUE,
  phone_e164 phone_e164 NOT NULL
    REFERENCES customer_subjects(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  package_id uuid
    REFERENCES packages(package_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  reward_rule_id uuid
    REFERENCES reward_rules(reward_rule_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  booking_type varchar(30) NOT NULL
    CHECK (booking_type IN ('FLIGHTS', 'HOTELS', 'HOLIDAYS')),
  purchased_amount numeric(12,2) NOT NULL CHECK (purchased_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  booking_status varchar(30) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (booking_status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'VOIDED')),
  booking_date timestamptz NOT NULL DEFAULT now(),
  travel_start_date date,
  travel_end_date date,
  created_source varchar(20) NOT NULL
    CHECK (created_source IN ('ADMIN', 'CUSTOMER', 'IMPORT', 'SYSTEM')),
  created_by varchar(100),
  deletion_reason text,
  deleted_by varchar(100),
  deleted_at timestamptz,
  record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (travel_end_date IS NULL OR travel_start_date IS NULL OR travel_end_date >= travel_start_date),
  CHECK (
    (booking_status = 'VOIDED' AND deleted_at IS NOT NULL AND deletion_reason IS NOT NULL)
    OR booking_status <> 'VOIDED'
  )
);

CREATE TABLE IF NOT EXISTS booking_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL
    REFERENCES bookings(booking_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  phone_e164 phone_e164 NOT NULL
    REFERENCES customer_subjects(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  event_type varchar(30) NOT NULL
    CHECK (event_type IN ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'VOIDED', 'RESTORED')),
  before_data jsonb,
  after_data jsonb,
  reason text,
  performed_by varchar(100) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_accounts (
  phone_e164 phone_e164 PRIMARY KEY
    REFERENCES customer_subjects(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  account_status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (account_status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 phone_e164 NOT NULL
    REFERENCES reward_accounts(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  booking_id uuid
    REFERENCES bookings(booking_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  entry_type varchar(30) NOT NULL
    CHECK (entry_type IN (
      'BOOKING_EARN',
      'BOOKING_REVERSAL',
      'REDEMPTION',
      'REDEMPTION_REVERSAL',
      'ADMIN_CREDIT',
      'ADMIN_DEBIT',
      'EXPIRY',
      'MIGRATION'
    )),
  points_delta integer NOT NULL CHECK (points_delta <> 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  source varchar(30) NOT NULL
    CHECK (source IN ('BOOKING', 'ADMIN', 'CUSTOMER', 'SYSTEM', 'MIGRATION')),
  idempotency_key varchar(100) NOT NULL UNIQUE,
  reversal_of uuid
    REFERENCES reward_ledger(entry_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  created_by varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    entry_type = 'MIGRATION'
    OR (entry_type IN ('BOOKING_EARN', 'REDEMPTION_REVERSAL', 'ADMIN_CREDIT') AND points_delta > 0)
    OR (entry_type IN ('BOOKING_REVERSAL', 'REDEMPTION', 'ADMIN_DEBIT', 'EXPIRY') AND points_delta < 0)
  ),
  CHECK (
    (entry_type IN ('BOOKING_EARN', 'BOOKING_REVERSAL') AND booking_id IS NOT NULL)
    OR entry_type NOT IN ('BOOKING_EARN', 'BOOKING_REVERSAL')
  ),
  CHECK (
    (entry_type IN ('BOOKING_REVERSAL', 'REDEMPTION_REVERSAL') AND reversal_of IS NOT NULL)
    OR entry_type NOT IN ('BOOKING_REVERSAL', 'REDEMPTION_REVERSAL')
  )
);

COMMENT ON TABLE reward_ledger IS
  'Immutable source of truth for all reward-point movements. Corrections require reversal entries.';

CREATE TABLE IF NOT EXISTS customer_reward_balances (
  phone_e164 phone_e164 PRIMARY KEY
    REFERENCES reward_accounts(phone_e164)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  available_points integer NOT NULL DEFAULT 0 CHECK (available_points >= 0),
  total_points_earned integer NOT NULL DEFAULT 0 CHECK (total_points_earned >= 0),
  total_points_redeemed integer NOT NULL DEFAULT 0 CHECK (total_points_redeemed >= 0),
  balance_version bigint NOT NULL DEFAULT 1 CHECK (balance_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_username varchar(100) NOT NULL,
  action varchar(100) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id varchar(150) NOT NULL,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_id varchar(100),
  ip_address_hash varchar(128),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domain_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type varchar(50) NOT NULL,
  aggregate_id varchar(150) NOT NULL,
  phone_e164 phone_e164,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_profiles_email
  ON portal_customer_profiles(email);
CREATE INDEX IF NOT EXISTS idx_admin_records_name
  ON admin_customer_records(lower(display_name));
CREATE INDEX IF NOT EXISTS idx_admin_records_email
  ON admin_customer_records(email);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_phone_active
  ON customer_sessions(phone_e164, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_username_active
  ON admin_sessions(admin_username, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_packages_status_type
  ON packages(status, booking_type);
CREATE INDEX IF NOT EXISTS idx_reward_catalog_category_order
  ON reward_catalog(category, display_order)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bookings_phone_date
  ON bookings(phone_e164, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_phone_status
  ON bookings(phone_e164, booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_active_travel_dates
  ON bookings(travel_start_date, travel_end_date)
  WHERE booking_status IN ('PENDING', 'CONFIRMED');
CREATE INDEX IF NOT EXISTS idx_booking_events_booking_time
  ON booking_events(booking_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_events_phone_time
  ON booking_events(phone_e164, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_phone_time
  ON reward_ledger(phone_e164, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_booking
  ON reward_ledger(booking_id)
  WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_ledger_reversal
  ON reward_ledger(reversal_of)
  WHERE reversal_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity_time
  ON admin_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_time
  ON admin_audit_logs(admin_username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_unpublished
  ON domain_events(created_at)
  WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_domain_events_phone_time
  ON domain_events(phone_e164, created_at DESC)
  WHERE phone_e164 IS NOT NULL;

DROP TRIGGER IF EXISTS trg_customer_subjects_updated_at ON customer_subjects;
CREATE TRIGGER trg_customer_subjects_updated_at
BEFORE UPDATE ON customer_subjects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_portal_customer_profiles_updated_at ON portal_customer_profiles;
CREATE TRIGGER trg_portal_customer_profiles_updated_at
BEFORE UPDATE ON portal_customer_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_customer_records_updated_at ON admin_customer_records;
CREATE TRIGGER trg_admin_customer_records_updated_at
BEFORE UPDATE ON admin_customer_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_auth_updated_at ON customer_auth;
CREATE TRIGGER trg_customer_auth_updated_at
BEFORE UPDATE ON customer_auth
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_packages_updated_at ON packages;
CREATE TRIGGER trg_packages_updated_at
BEFORE UPDATE ON packages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reward_catalog_updated_at ON reward_catalog;
CREATE TRIGGER trg_reward_catalog_updated_at
BEFORE UPDATE ON reward_catalog
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reward_accounts_updated_at ON reward_accounts;
CREATE TRIGGER trg_reward_accounts_updated_at
BEFORE UPDATE ON reward_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION reject_reward_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'reward_ledger is immutable; create a reversal entry instead'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_ledger_no_update ON reward_ledger;
CREATE TRIGGER trg_reward_ledger_no_update
BEFORE UPDATE ON reward_ledger
FOR EACH ROW EXECUTE FUNCTION reject_reward_ledger_mutation();

DROP TRIGGER IF EXISTS trg_reward_ledger_no_delete ON reward_ledger;
CREATE TRIGGER trg_reward_ledger_no_delete
BEFORE DELETE ON reward_ledger
FOR EACH ROW EXECUTE FUNCTION reject_reward_ledger_mutation();

CREATE OR REPLACE FUNCTION apply_reward_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  earned_delta integer := 0;
  redeemed_delta integer := 0;
BEGIN
  IF NEW.entry_type IN ('BOOKING_EARN', 'ADMIN_CREDIT') THEN
    earned_delta := NEW.points_delta;
  ELSIF NEW.entry_type = 'BOOKING_REVERSAL' THEN
    earned_delta := NEW.points_delta;
  ELSIF NEW.entry_type = 'REDEMPTION' THEN
    redeemed_delta := abs(NEW.points_delta);
  ELSIF NEW.entry_type = 'REDEMPTION_REVERSAL' THEN
    redeemed_delta := -NEW.points_delta;
  ELSIF NEW.entry_type = 'MIGRATION' AND NEW.points_delta > 0 THEN
    earned_delta := NEW.points_delta;
  END IF;

  UPDATE customer_reward_balances
  SET available_points = available_points + NEW.points_delta,
      total_points_earned = total_points_earned + earned_delta,
      total_points_redeemed = total_points_redeemed + redeemed_delta,
      balance_version = balance_version + 1,
      updated_at = now()
  WHERE phone_e164 = NEW.phone_e164;

  IF NOT FOUND THEN
    IF NEW.points_delta < 0 OR earned_delta < 0 OR redeemed_delta < 0 THEN
      RAISE EXCEPTION 'cannot apply a negative reward entry without an existing sufficient balance'
        USING ERRCODE = '23514';
    END IF;

    INSERT INTO customer_reward_balances (
      phone_e164,
      available_points,
      total_points_earned,
      total_points_redeemed,
      balance_version,
      updated_at
    ) VALUES (
      NEW.phone_e164,
      NEW.points_delta,
      earned_delta,
      redeemed_delta,
      1,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_ledger_apply_balance ON reward_ledger;
CREATE TRIGGER trg_reward_ledger_apply_balance
AFTER INSERT ON reward_ledger
FOR EACH ROW EXECUTE FUNCTION apply_reward_ledger_entry();

CREATE OR REPLACE VIEW customer_dashboard_summary
WITH (security_invoker = true)
AS
SELECT
  subject.phone_e164,
  count(booking.booking_id) FILTER (
    WHERE booking.booking_status IN ('PENDING', 'CONFIRMED', 'COMPLETED')
  )::integer AS total_bookings,
  coalesce(balance.available_points, 0)::integer AS available_points,
  coalesce(balance.total_points_earned, 0)::integer AS total_points_earned,
  coalesce(balance.total_points_redeemed, 0)::integer AS total_points_redeemed,
  coalesce(balance.balance_version, 0)::bigint AS balance_version,
  greatest(
    subject.updated_at,
    coalesce(balance.updated_at, subject.updated_at),
    coalesce(max(booking.updated_at), subject.updated_at)
  ) AS updated_at
FROM customer_subjects AS subject
LEFT JOIN bookings AS booking
  ON booking.phone_e164 = subject.phone_e164
LEFT JOIN customer_reward_balances AS balance
  ON balance.phone_e164 = subject.phone_e164
GROUP BY
  subject.phone_e164,
  subject.updated_at,
  balance.available_points,
  balance.total_points_earned,
  balance.total_points_redeemed,
  balance.balance_version,
  balance.updated_at;

ALTER TABLE customer_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_customer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reward_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;

-- This architecture uses the backend service role for all database access.
-- Direct access from Supabase anon/authenticated roles remains blocked until
-- explicit least-privilege RLS policies are introduced.
DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'customer_subjects', 'portal_customer_profiles', 'admin_customer_records',
      'customer_auth', 'customer_sessions', 'admin_sessions', 'reward_rules', 'reward_catalog',
      'packages', 'bookings', 'booking_events', 'reward_accounts', 'reward_ledger',
      'customer_reward_balances', 'admin_audit_logs', 'domain_events'
    ]
    LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', table_name);
    END LOOP;
    REVOKE ALL ON TABLE customer_dashboard_summary FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'customer_subjects', 'portal_customer_profiles', 'admin_customer_records',
      'customer_auth', 'customer_sessions', 'admin_sessions', 'reward_rules', 'reward_catalog',
      'packages', 'bookings', 'booking_events', 'reward_accounts', 'reward_ledger',
      'customer_reward_balances', 'admin_audit_logs', 'domain_events'
    ]
    LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', table_name);
    END LOOP;
    REVOKE ALL ON TABLE customer_dashboard_summary FROM authenticated;
  END IF;
END
$$;

COMMIT;
