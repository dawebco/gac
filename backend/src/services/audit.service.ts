import { PoolClient } from 'pg';

interface AuditInput {
  adminUsername: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string;
  requestId?: string;
  ipAddressHash?: string;
  userAgent?: string;
}

export async function writeAdminAudit(client: PoolClient, input: AuditInput): Promise<void> {
  await client.query(
    `INSERT INTO admin_audit_logs (
      admin_username, action, entity_type, entity_id, before_data, after_data,
      reason, request_id, ip_address_hash, user_agent
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)`,
    [
      input.adminUsername,
      input.action,
      input.entityType,
      input.entityId,
      input.beforeData === undefined ? null : JSON.stringify(input.beforeData),
      input.afterData === undefined ? null : JSON.stringify(input.afterData),
      input.reason ?? null,
      input.requestId ?? null,
      input.ipAddressHash ?? null,
      input.userAgent ?? null,
    ],
  );
}
