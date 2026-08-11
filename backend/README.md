# GAC Holidays Backend

Core Node.js/TypeScript backend foundation for GAC Holidays. This service is
kept separate from the existing React frontend and uses PostgreSQL directly;
there is no Prisma dependency or generated ORM layer.

## Implemented scope

- Express + TypeScript API scaffold
- Strict environment validation
- PostgreSQL connection pool and transaction helper
- Supabase service-role client
- Upstash Redis client
- Structured/redacted logging
- Security, CORS, compression, request IDs and error middleware
- Liveness and readiness endpoints
- Complete initial PostgreSQL schema
- Reward rules: Hotels/Holidays `₹1 = 1 point`; Flights `₹5 = 1 point`
- Argon2-backed admin authentication with opaque HttpOnly sessions and CSRF protection
- Independent portal and admin-created customer records linked by E.164 phone identity
- Transactional booking creation/voiding with automatic reward credits/reversals
- Immutable manual reward adjustments and unified dashboard summaries
- Live frontend integration for the customer and admin dashboards

WhatsApp and OTP implementation is intentionally deferred.

## Directory structure

```text
backend/
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── schema.sql
├── tsconfig.json
└── src/
    ├── app.ts
    ├── server.ts
    ├── config/
    │   ├── env.ts
    │   └── logger.ts
    ├── database/
    │   ├── postgres.ts
    │   ├── redis.ts
    │   └── supabase.ts
    ├── middleware/
    ├── routes/
    ├── services/
    ├── scripts/
    └── shared/
        └── api-error.ts
```

## Local setup

1. Create a Supabase project.
2. Run `npm run db:apply` to apply `schema.sql`.
3. Copy `.env.example` to `.env` and replace every placeholder.
4. From the `backend` directory, run `npm install`.
5. Run `npm run dev`.

The API defaults to `http://localhost:4000`.

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

`/health/live` confirms that the Node process is running. `/health/ready`
checks PostgreSQL and Redis and returns HTTP 503 if either dependency is down.

Useful verification commands:

```text
npm run verify:infra
npm run verify:domain
npm run typecheck
npm run build
```

`verify:domain` exercises booking rewards, reversals, manual adjustments, and
the unified dashboard view inside a transaction that is always rolled back.

## Database connection guidance

For a continuously running backend, use the Supabase direct connection or
session pooler. For a serverless deployment, use the transaction pooler URL and
keep the PostgreSQL pool small. The service-role key must exist only in the
backend environment and must never use a `REACT_APP_` or other public prefix.

## Security model

All sensitive tables have Row Level Security enabled with no public policies.
The backend is the only application allowed to use the Supabase service role.
The `reward_ledger` rejects updates and deletions at database level; corrections
must be represented by new reversal entries.
