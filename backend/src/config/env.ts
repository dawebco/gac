import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Support both the repository-level .env used by the React app and a dedicated
// backend/.env. Real deployment environment variables always take precedence.
[
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
].forEach((envPath) => dotenv.config({ path: envPath, override: false, quiet: true }));

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_NAME: z.string().trim().min(1).default('GAC Holidays API'),
  API_PREFIX: z.string().trim().regex(/^\//).default('/api/v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: booleanFromString.default(false),
  CORS_ORIGINS: z.string().trim().min(1).default('http://localhost:3000'),
  DATABASE_URL: z.string().trim().min(1).refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'DATABASE_URL must be a PostgreSQL connection string',
  ),
  DATABASE_SSL: booleanFromString.default(true),
  DATABASE_SSL_REJECT_UNAUTHORIZED: booleanFromString.default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().trim().min(10),
  ADMIN_USERNAME: z.string().trim().min(3).max(100).optional(),
  ADMIN_PASSWORD_HASH: z.string().trim().min(20).optional(),
  SUPER_ADMIN_USERNAME: z.string().trim().min(3).max(100).optional(),
  SUPER_ADMIN_PASSWORD_HASH: z.string().trim().min(20).optional(),
  REACT_APP_ADMIN_USERNAME: z.string().trim().min(3).max(100).optional(),
  REACT_APP_ADMIN_PASSWORD_HASH: z.string().trim().min(20).optional(),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  CUSTOMER_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  ENABLE_DUMMY_OTP_AUTH: booleanFromString.default(true),
  COOKIE_SECURE: booleanFromString.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().trim().optional(),
  WHATSAPP_CLOUD_API_TOKEN: z.string().trim().optional(),
  WHATSAPP_TEMPLATE_NAME_OTP: z.string().trim().default('gac_holidays'),
  WHATSAPP_TEMPLATE_NAME_REWARDS: z.string().trim().default('gac_booking_rewards'),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().trim().default('en_US'),
  WHATSAPP_GRAPH_VERSION: z.string().trim().default('v20.0'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid backend environment configuration: ${details}`);
}

export const env = Object.freeze({
  ...parsed.data,
  ADMIN_USERNAME: parsed.data.ADMIN_USERNAME ?? parsed.data.REACT_APP_ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH: parsed.data.ADMIN_PASSWORD_HASH ?? parsed.data.REACT_APP_ADMIN_PASSWORD_HASH,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});

export type Environment = typeof env;
