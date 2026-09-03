# GAC Holidays Rewards — Project Documentation

This is the technical handover document for the GAC Holidays Rewards application. It describes the code and live data model as they exist in this repository. Read this before changing authentication, points, bookings, or deletion flows.

## 1. Purpose and user roles

The application is a travel-rewards portal with three separate user roles.

| Role | Entry point | Primary responsibility |
| --- | --- | --- |
| Customer | `/` | Registers with a phone number, logs in with WhatsApp OTP, views bookings/points/rewards, and requests redemptions. |
| Admin | `/admin` | Creates and manages operational customer records, adds/voids bookings, submits point-adjustment requests, manages reward change requests, reviews customer redemption requests, sends booking-reward WhatsApp messages, and requests customer deletion. |
| Super admin | `/super-admin` | Independently approves/rejects admin point adjustments, reward catalog changes, and customer-deletion requests. |

The identifiers and password hashes for Admin and Super Admin come from environment variables. Do not put passwords, database URLs, service-role keys, Redis tokens, or WhatsApp tokens in source code, browser code, documentation, or Git.

## 2. Architecture at a glance

```text
React browser application (src/)
        |
        | HTTPS / REST, HttpOnly session cookies
        v
Express API (backend/src/)
        |                 |                    |
        v                 v                    v
Supabase PostgreSQL   Upstash Redis       Meta WhatsApp Cloud API
  identities,         rate limits,        OTP and booking-reward
  bookings, points,   one-time OTPs       template messages
  audit records
        |
        v
Supabase Storage (reward images only; service-role access from backend)
```

Frontend API base URL is configured in `src/api.js`:

- Production default: `/api/v1` (same deployed origin).
- Local default: `http://localhost:4000/api/v1`.
- Optional override: `REACT_APP_API_URL`.

The Express app is mounted at `/api/v1` in `backend/src/app.ts`.

## 3. Repository map

```text
E:\gac
├── src/
│   ├── App.js             Customer, Admin, and Super Admin React UI
│   ├── api.js             Browser API client and CSRF header handling
│   ├── Admin.css          Admin/Super Admin styling
│   └── index.css          Customer portal styling
├── public/                Static public assets, including WhatsApp reward images
├── backend/
│   ├── schema.sql         PostgreSQL schema, views, triggers, RLS
│   ├── src/app.ts         Express middleware and route mounting
│   ├── src/server.ts      Local Node HTTP listener
│   ├── src/config/env.ts  Environment validation/defaults
│   ├── src/database/      PostgreSQL, Redis, Supabase clients
│   ├── src/middleware/    Customer/Admin/Super Admin authorization
│   ├── src/routes/        HTTP endpoints
│   ├── src/services/      Business rules and database transactions
│   └── src/scripts/       Schema/infrastructure/domain verification helpers
├── package.json           Frontend/root commands
└── vercel.json            Deployment routing configuration
```

## 4. How to run locally

### Prerequisites

- Node.js compatible with the project (backend declares Node 22).
- `node_modules` installed in both the root and `backend` directories.
- Valid backend environment settings in `backend/.env` (or root `.env`): PostgreSQL, Redis, Supabase, and relevant credentials.
- Network access to Supabase PostgreSQL, Upstash Redis, and Meta WhatsApp if testing live OTP/messages.

### Start commands

Open two PowerShell windows:

```powershell
# Terminal 1: React frontend
cd E:\gac
node node_modules/react-scripts/bin/react-scripts.js start
```

```powershell
# Terminal 2: API server
cd E:\gac\backend
node node_modules/tsx/dist/cli.mjs src/server.ts
```

Open `http://localhost:3000`.

> Important: `backend/package.json` currently has a `dev` script that targets `src/app.ts`. That file builds the Express app but does not call `listen()`. For local API work, use `src/server.ts` as shown above until that script is deliberately corrected and tested.

### Health checks

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health/live
Invoke-RestMethod http://localhost:4000/api/v1/health/ready
```

- `live` only confirms the Node process is running.
- `ready` verifies PostgreSQL and Redis. Both must be `up` for logins, OTP, registrations, points, and most admin operations.

### Useful checks before deployment

```powershell
node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit
node node_modules/react-scripts/bin/react-scripts.js build
```

Do not commit `.env` files or local log files.

## 5. Data ownership and database model

### Platform and access boundary

The system uses Supabase PostgreSQL directly through the backend `pg` pool. It does not use Prisma. Supabase Storage is used for reward images. The browser does not receive a database password or Supabase service-role key.

All principal tables have Row Level Security enabled and public `anon`/`authenticated` access is revoked in the schema. The backend service role/database connection is the trusted data-access layer.

### Customer identity is deliberately split

Every known person is anchored by one canonical E.164 phone number in `customer_subjects`.

| Table | Owner / meaning |
| --- | --- |
| `customer_subjects` | Canonical phone identity and high-level status. A row does not itself mean the customer can use the portal or appears in Admin. |
| `portal_customer_profiles` | Customer self-registration: name, email, date of birth, portal profile status, registration time. |
| `admin_customer_records` | Admin-created operational customer record: display name, email, notes, status, creator. It is independent of the portal profile. |
| `customer_auth` | Customer authentication/verification status. |
| `customer_sessions` | Hashed customer session tokens, expiry, revocation, last-seen time. |
| `admin_sessions` | Hashed Admin/Super Admin sessions and CSRF-token hashes. |

This separation is intentional. A portal registration does **not** automatically create an Admin customer record or a booking. An Admin customer record does **not** automatically create portal access.

### Operational and rewards tables

| Area | Tables |
| --- | --- |
| Bookings | `bookings`, `booking_events`, optional `packages` |
| Rewards catalog | `reward_rules`, `reward_catalog` |
| Points accounting | `reward_accounts`, `reward_ledger`, `customer_reward_balances` |
| Approval queues | `reward_adjustment_requests`, `reward_redemption_requests`, runtime-created `reward_change_requests`, runtime-created `customer_deletion_requests` |
| Audit/integration | `admin_audit_logs`, `domain_events` |

`customer_dashboard_summary` is a PostgreSQL view used for the visible booking and points totals.

## 6. Customer registration, OTP login, and dashboard

### Registration flow

1. Customer submits name, email, Indian mobile number, and date of birth in `CustomerApp` in `src/App.js`.
2. `portalApi.register()` calls `POST /portal/customers/register`.
3. The API rate-limits registrations by IP in Redis (maximum 10 per hour).
4. `registerPortalCustomer()` normalizes the phone to `+91…`, creates/activates `customer_subjects`, inserts `portal_customer_profiles`, creates a `PENDING` `customer_auth` record, and ensures a reward account/balance exist. These operations are one database transaction.
5. A hashed customer session is created and returned as the HttpOnly `gac_customer_session` cookie scoped to `/api/v1/portal`.
6. The response includes profile, dashboard totals, bookings, reward catalog, and redemptions. The UI then returns the person to the login screen.

Self-registered details are stored in `portal_customer_profiles`, not in `admin_customer_records`.

### Login/OTP flow

1. Customer enters phone number and clicks **Send OTP**.
2. `POST /portal/auth/send-otp` rate-limits by phone/IP (five per minute), creates a six-digit OTP, and stores it in Redis for five minutes under `otp:+91…`.
3. If WhatsApp environment settings are present, the backend sends the code through the configured Meta WhatsApp template. Without those settings, the code is only logged by the backend for development.
4. Customer sends the code to `POST /portal/auth/verify-otp`.
5. The backend validates the Redis value, removes it, activates/updates customer authentication as needed, creates a session, and returns dashboard data.

### Current OTP caveat

`ENABLE_DUMMY_OTP_AUTH` defaults to `true`. When true, **any four-digit OTP is accepted** by `/portal/auth/verify-otp`, even if it does not match Redis. This is a development fallback and should be disabled (`false`) in a production environment that requires real OTP verification.

### Customer dashboard capabilities

After a valid customer session, the portal displays profile details, bookings/history, available and earned/redeemed points, reward catalog entries, and redemption status. Customers can submit redemption requests but cannot directly deduct points or approve themselves.

## 7. Admin role and workflows

Admin credentials are configured with `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`. Password verification supports Argon2id hashes. On a successful login, an opaque HttpOnly `gac_admin_session` cookie and CSRF token are created. State-changing Admin requests must carry `X-CSRF-Token`.

### Admin UI capabilities

- Dashboard totals and latest Admin customer records.
- Register an operational customer and optionally add their first booking.
- Manage Admin customer records, inspect bookings and points, add bookings, and void bookings.
- Submit manual point-add/remove requests for Super Admin approval.
- View/review customer reward-redemption requests.
- Create, edit, and delete reward catalog entries as requests for Super Admin approval; reward image uploads go to Supabase Storage.
- Send a booking-reward WhatsApp message manually.
- Generate/download booking reports.
- Request a customer deletion using the exact confirmation text `confirm_delete`; Super Admin must approve it.
- **New Customers:** find self-registered records that have no `admin_customer_records` row and no booking row; search by name/email/phone, filter by self-registration Start Date/End Date, and download the qualifying date-filtered list as an Excel-compatible `.xls` file.

### Admin cannot do directly

- Finalize manual point adjustments.
- Apply reward-catalog changes directly.
- Permanently delete customer data directly.

Those are deliberately approval-gated actions.

## 8. Super Admin role and responsibilities

Super Admin is a separately authenticated role, configured through `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD_HASH`. It uses its own `gac_superadmin_session` cookie and requires the session username to match the configured Super Admin username.

Super Admin reviews these queues:

1. **Manual point adjustments** — approves/rejects Admin requests to add or remove points. Approval creates an immutable `ADMIN_CREDIT` or `ADMIN_DEBIT` ledger entry.
2. **Reward catalog changes** — approves/rejects Admin requests to create, edit, or remove rewards. Approval writes the proposed change to `reward_catalog`; uploaded images have already been stored in Supabase Storage.
3. **Customer deletion requests** — approves/rejects requests. Approval performs a hard transactional purge of the customer’s related operational/profile/auth/session/reward/booking data, including Supabase Auth cleanup where applicable.

The implementation is in `backend/src/routes/superadmin.routes.ts`, `backend/src/routes/superadmin-auth.routes.ts`, and the related service functions. Treat customer deletion as irreversible in normal operations.

## 9. Bookings and reward points

### Booking creation

Only an Admin operational customer can receive a booking through the current API. When an Admin creates a booking:

1. The API checks that `admin_customer_records` contains an active customer for the phone number.
2. It selects the active `reward_rules` row that matches booking type and booking date.
3. Points are calculated as `floor(purchased amount / rupees per point)`.
4. A `CONFIRMED` booking is inserted with source `ADMIN`.
5. A booking event, a `BOOKING_EARN` ledger entry (if points > 0), an admin audit record, and a domain event are written in the same transaction.

Initial schema rules are:

| Booking type | Rule |
| --- | --- |
| Flights | 1 point for every ₹5 |
| Hotels | 1 point for every ₹1 |
| Holidays | 1 point for every ₹1 |

The database rule table is the source of truth, so changes must be made carefully with date-effective rules rather than hard-coded UI values.

### Ledger and balances

`reward_ledger` is immutable: database triggers reject updates and deletes. Every movement is a new row. A trigger applies each new ledger entry to `customer_reward_balances`, which stores available, earned, and redeemed totals for quick dashboard reads.

Important ledger entry types:

- `BOOKING_EARN`: points earned from a confirmed booking.
- `BOOKING_REVERSAL`: negative reversal when a booking is voided.
- `ADMIN_CREDIT` / `ADMIN_DEBIT`: approved manual adjustment.
- `REDEMPTION`: approved reward redemption (negative).
- `REDEMPTION_REVERSAL`, `EXPIRY`, `MIGRATION`: reserved/special cases.

### Voiding a booking

An Admin can void a booking. The backend locks the booking and balance, refuses to void it if the original earned points have already been spent, inserts a `BOOKING_REVERSAL` entry when possible, marks the booking `VOIDED`, and writes booking/audit events.

### Redemption flow

1. Customer submits `POST /portal/rewards/redeem` with an idempotency key.
2. The backend verifies the reward is active, locks the balance, confirms sufficient points, and creates a `PENDING` `reward_redemption_requests` row.
3. Admin sees the pending request and approves or rejects it.
4. Approval rechecks the locked balance, writes a negative `REDEMPTION` ledger entry, and marks the request approved. Rejection only changes request status.

## 10. WhatsApp integration

Implementation: `backend/src/services/whatsapp.service.ts`.

The backend calls Meta’s Graph API (`/{graph version}/{phone number ID}/messages`) using a server-only bearer token. It sends template messages—not arbitrary free-form messages.

| Message | Trigger | Template/environment setting |
| --- | --- | --- |
| OTP | Customer asks to send OTP | `WHATSAPP_TEMPLATE_NAME_OTP` |
| Booking-reward notification | Admin clicks **Send Rewards** | `WHATSAPP_TEMPLATE_NAME_REWARDS` |

The booking-reward template receives an image header selected by booking type plus customer name, newly earned points, and total points balance. The image normally resolves from `PUBLIC_BASE_URL` (default `https://reward.gacholidays.com`) under `/images/`.

Required settings: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_GRAPH_VERSION`, template names, and language. If they are not configured, OTP dispatch logs the code only in development; a manual reward-message request returns a configuration error.

## 11. API route map

All paths below are under `/api/v1`.

| Area | Key routes |
| --- | --- |
| Health | `GET /health/live`, `GET /health/ready` |
| Customer portal | `GET /portal/rewards`, `POST /portal/customers/register`, `POST /portal/auth/send-otp`, `POST /portal/auth/verify-otp`, `POST /portal/rewards/redeem`, `GET /portal/session/dashboard`, `POST /portal/session/logout` |
| Admin authentication | `POST /admin/auth/login`, `GET /admin/auth/session`, `POST /admin/auth/logout` |
| Admin operations | `/admin/overview`, `/admin/customers`, `/admin/customers/:phone`, booking and adjustment subroutes, `/admin/new-customers`, `/admin/rewards`, `/admin/redemption-requests`, `/admin/send-whatsapp-reward`, deletion-request routes |
| Super Admin authentication | `POST /superadmin/auth/login`, `GET /superadmin/auth/session`, `POST /superadmin/auth/logout` |
| Super Admin approvals | `/superadmin/reward-requests`, `/superadmin/reward-change-requests`, `/superadmin/customer-deletion-requests` and their `/:requestId/review` routes |

Read routes require the appropriate session. State-changing Admin/Super Admin routes require a valid CSRF header. Booking, reward adjustment, and redemption creation use idempotency keys to protect against repeated submissions.

## 12. Environment variables and operational checklist

Use `backend/.env.example` as the non-secret configuration reference. Essential categories:

| Category | Examples |
| --- | --- |
| Server | `NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGINS`, cookie flags |
| PostgreSQL | `DATABASE_URL`, SSL and pool settings |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Privileged users | Admin/Super Admin usernames and Argon2 password hashes |
| Customer auth | `ENABLE_DUMMY_OTP_AUTH`, customer-session TTL |
| WhatsApp | phone-number ID, API token, Graph version, template names/language |

Before a production change:

1. Confirm `/health/ready` reports PostgreSQL and Redis as up.
2. Never expose a service-role key or token in React variables (`REACT_APP_*`).
3. Verify the target role and approval workflow; do not bypass the ledger or change database totals manually.
4. Build frontend and typecheck backend.
5. Test role-specific behavior in a safe account: customer registration/OTP, Admin booking/approval actions, Super Admin approval actions.
6. For schema changes, review triggers, constraints, RLS, and existing data before applying `schema.sql` changes.

## 13. Code-change guide

| Change requested | Start here |
| --- | --- |
| Customer registration/login/dashboard | `src/App.js`, `src/api.js`, `backend/src/routes/portal.routes.ts`, `backend/src/services/customer.service.ts` |
| Admin customer/booking workflow | `src/App.js`, `backend/src/routes/admin.routes.ts`, `backend/src/services/customer.service.ts`, `backend/src/services/booking.service.ts` |
| Points calculations/adjustments | `backend/schema.sql`, `backend/src/services/booking.service.ts`, `backend/src/services/reward.service.ts` |
| Redemption workflow | `backend/src/services/reward-redemption.service.ts`, Admin UI in `src/App.js` |
| Reward catalog | `backend/src/services/reward-catalog.service.ts`, Admin/Super Admin UI in `src/App.js` |
| WhatsApp | `backend/src/services/whatsapp.service.ts`, relevant portal/admin route |
| Authentication/cookies/CSRF | `backend/src/services/admin-auth.service.ts`, `backend/src/middleware/admin-auth.ts`, `backend/src/middleware/customer-auth.ts` |
| Database | `backend/schema.sql`; use service transactions rather than raw UI-side updates |

## 14. Known maintenance notes

- The backend README is stale about OTP/WhatsApp; this document reflects the code currently in the repository.
- The local backend `dev` script issue is documented in the run section. Do not change it casually in a production hotfix; update and test it separately.
- The temporary approval-request tables for reward changes and customer deletion are created by services at runtime. Include them in backup, audit, and schema-management planning.
- Customer deletion approval intentionally performs hard deletion across related records. Review this code and backup policy before using it in production.
- Dummy OTP acceptance is unsafe for a production authentication requirement. Disable it after confirming real WhatsApp OTP delivery works.
