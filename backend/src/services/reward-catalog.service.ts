import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../database/postgres';
import { supabaseAdmin } from '../database/supabase';
import { ApiError } from '../shared/api-error';
import type { AuditContext } from './customer.service';
import { writeAdminAudit } from './audit.service';

const REWARD_BUCKET = 'reward-images';

interface RewardRow {
  reward_id: string;
  reward_code: string;
  category: 'FEATURED' | 'MILESTONE';
  points_required: number;
  title: string;
  description: string;
  image_url: string | null;
  image_storage_path: string | null;
  valid_until: string | null;
  display_order: number;
  updated_at: Date;
}

function mapReward(row: RewardRow) {
  return {
    id: row.reward_id,
    code: row.reward_code,
    category: row.category,
    pointsRequired: Number(row.points_required),
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    validUntil: row.valid_until,
    displayOrder: Number(row.display_order),
    updatedAt: row.updated_at,
  };
}

const rewardColumns = `reward_id, reward_code, category, points_required, title,
  description, image_url, image_storage_path, valid_until, display_order, updated_at`;

export async function listRewards() {
  const result = await query<RewardRow>(
    `SELECT ${rewardColumns} FROM reward_catalog
     WHERE is_active = true ORDER BY category, display_order`,
  );
  return result.rows.map(mapReward);
}

export async function ensureRewardBucket(): Promise<void> {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw new ApiError(502, 'STORAGE_UNAVAILABLE', 'Unable to access reward image storage.');
  if (buckets.some((bucket) => bucket.id === REWARD_BUCKET)) return;

  const { error } = await supabaseAdmin.storage.createBucket(REWARD_BUCKET, {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 8 * 1024 * 1024,
  });
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new ApiError(502, 'STORAGE_BUCKET_CREATE_FAILED', 'Unable to initialize reward image storage.');
  }
}

export async function createReward(input: {
  title: string;
  description: string;
  pointsRequired: number;
  category: 'FEATURED' | 'MILESTONE';
  image?: Express.Multer.File;
  audit: AuditContext;
}) {
  const trimmedTitle = input.title.trim();
  const trimmedDescription = input.description.trim();
  const pointsRequired = Number(input.pointsRequired);
  if (!Number.isInteger(pointsRequired) || pointsRequired <= 0) {
    throw new ApiError(400, 'INVALID_REWARD_POINTS', 'Reward points must be a positive integer.');
  }
  if (trimmedTitle.length < 2 || trimmedDescription.length < 3) {
    throw new ApiError(400, 'INVALID_REWARD_DETAILS', 'Reward title and description are required.');
  }

  let imageUrl: string | null = null;
  let storagePath: string | null = null;
  if (input.image) {
    await ensureRewardBucket();
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const extension = extensionByType[input.image.mimetype];
    if (!extension) throw new ApiError(400, 'INVALID_REWARD_IMAGE', 'Upload a JPG, PNG, or WebP image.');
    storagePath = `rewards/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(REWARD_BUCKET)
      .upload(storagePath, input.image.buffer, {
        contentType: input.image.mimetype,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) throw new ApiError(502, 'REWARD_IMAGE_UPLOAD_FAILED', 'The reward image could not be uploaded.');
    imageUrl = supabaseAdmin.storage.from(REWARD_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  }

  const result = await withTransaction(async (client) => {
    const nextOrderResult = await client.query<{ next_order: number }>(
      `SELECT coalesce(max(display_order), 0) + 1 AS next_order
       FROM reward_catalog WHERE category = $1`,
      [input.category],
    );
    const displayOrder = Number(nextOrderResult.rows[0]?.next_order ?? 1);
    const rewardCode = `${input.category}_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const insertResult = await client.query<RewardRow>(
      `INSERT INTO reward_catalog (
         reward_code, category, points_required, title, description, image_url, image_storage_path,
         display_order, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${rewardColumns}`,
      [rewardCode, input.category, pointsRequired, trimmedTitle, trimmedDescription, imageUrl, storagePath, displayOrder, input.audit.adminUsername],
    );

    await writeAdminAudit(client, {
      ...input.audit,
      action: 'REWARD_CREATED',
      entityType: 'REWARD_CATALOG',
      entityId: insertResult.rows[0]!.reward_id,
      afterData: mapReward(insertResult.rows[0]!),
    });

    return insertResult.rows[0]!;
  });

  return mapReward(result);
}

export async function updateReward(input: {
  rewardId: string;
  title?: string; // Made optional
  description?: string; // Made optional
  pointsRequired?: number;
  image?: Express.Multer.File;
  audit: AuditContext;
}) {
  const existingResult = await query<RewardRow>(
    `SELECT ${rewardColumns} FROM reward_catalog WHERE reward_id = $1 AND is_active = true LIMIT 1`,
    [input.rewardId],
  );
  const existing = existingResult.rows[0];
  if (!existing) throw new ApiError(404, 'REWARD_NOT_FOUND', 'Reward card not found.');

  const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const nextDescription = input.description !== undefined ? input.description.trim() : existing.description;
  if (nextTitle.length < 2 || nextDescription.length < 3) {
    throw new ApiError(400, 'INVALID_REWARD_DETAILS', 'Reward title and description are required.');
  }

  const nextPointsRequired = input.pointsRequired !== undefined ? Number(input.pointsRequired) : Number(existing.points_required);
  if (!Number.isInteger(nextPointsRequired) || nextPointsRequired <= 0) {
    throw new ApiError(400, 'INVALID_REWARD_POINTS', 'Reward points must be a positive integer.');
  }

  let newStoragePath: string | null = null;
  let imageUrl = existing.image_url;
  if (input.image) {
    await ensureRewardBucket();
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const extension = extensionByType[input.image.mimetype];
    if (!extension) throw new ApiError(400, 'INVALID_REWARD_IMAGE', 'Upload a JPG, PNG, or WebP image.');
    newStoragePath = `rewards/${input.rewardId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(REWARD_BUCKET)
      .upload(newStoragePath, input.image.buffer, {
        contentType: input.image.mimetype,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) throw new ApiError(502, 'REWARD_IMAGE_UPLOAD_FAILED', 'The reward image could not be uploaded.');
    imageUrl = supabaseAdmin.storage.from(REWARD_BUCKET).getPublicUrl(newStoragePath).data.publicUrl;
  }

  try {
    const updated = await withTransaction(async (client) => {
      const result = await client.query<RewardRow>(
        `UPDATE reward_catalog
         SET title = $1, description = $2, points_required = $3, image_url = $4,
             image_storage_path = coalesce($5, image_storage_path), updated_by = $6
         WHERE reward_id = $7
         RETURNING ${rewardColumns}`,
        [nextTitle, nextDescription, nextPointsRequired, imageUrl, newStoragePath, input.audit.adminUsername, input.rewardId],
      );
      await writeAdminAudit(client, {
        ...input.audit,
        action: 'REWARD_UPDATED',
        entityType: 'REWARD_CATALOG',
        entityId: input.rewardId,
        beforeData: mapReward(existing),
        afterData: mapReward(result.rows[0]!),
      });
      return result.rows[0]!;
    });

    if (newStoragePath && existing.image_storage_path) {
      void supabaseAdmin.storage.from(REWARD_BUCKET).remove([existing.image_storage_path]);
    }
    return mapReward(updated);
  } catch (error) {
    if (newStoragePath) await supabaseAdmin.storage.from(REWARD_BUCKET).remove([newStoragePath]);
    throw error;
  }
}

export async function deleteReward(input: {
  rewardId: string;
  audit: AuditContext;
}) {
  const existingResult = await query<RewardRow>(
    `SELECT ${rewardColumns} FROM reward_catalog WHERE reward_id = $1 AND is_active = true LIMIT 1`,
    [input.rewardId],
  );
  const existing = existingResult.rows[0];
  if (!existing) throw new ApiError(404, 'REWARD_NOT_FOUND', 'Reward card not found.');

  const deleted = await withTransaction(async (client) => {
    const result = await client.query<RewardRow>(
      `UPDATE reward_catalog
       SET is_active = false, updated_by = $1, updated_at = now()
       WHERE reward_id = $2 AND is_active = true
       RETURNING ${rewardColumns}`,
      [input.audit.adminUsername, input.rewardId],
    );
    await writeAdminAudit(client, {
      ...input.audit,
      action: 'REWARD_DELETED',
      entityType: 'REWARD_CATALOG',
      entityId: input.rewardId,
      beforeData: mapReward(existing),
      afterData: mapReward(result.rows[0]!),
    });
    return result.rows[0]!;
  });

  return mapReward(deleted);
}

export interface RewardChangeRequestRow {
  request_id: string;
  reward_id: string | null;
  request_type: 'CREATE' | 'UPDATE' | 'DELETE';
  category: 'FEATURED' | 'MILESTONE';
  proposed_title: string | null;
  proposed_description: string | null;
  proposed_points: number | null;
  proposed_image_url: string | null;
  proposed_image_storage_path: string | null;
  is_deletion: boolean;
  changes_summary: string;
  request_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  requested_at: Date;
  reviewed_at: Date | null;
}

export async function ensureRewardChangeRequestsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS reward_change_requests (
      request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reward_id uuid REFERENCES reward_catalog(reward_id) ON UPDATE CASCADE ON DELETE SET NULL,
      request_type varchar(20) NOT NULL CHECK (request_type IN ('CREATE', 'UPDATE', 'DELETE')),
      category varchar(20) NOT NULL CHECK (category IN ('FEATURED', 'MILESTONE')),
      proposed_title text,
      proposed_description text,
      proposed_points integer,
      proposed_image_url text,
      proposed_image_storage_path text,
      is_deletion boolean NOT NULL DEFAULT false,
      changes_summary text NOT NULL,
      request_status varchar(12) NOT NULL DEFAULT 'PENDING' CHECK (request_status IN ('PENDING', 'APPROVED', 'REJECTED')),
      requested_by varchar(100) NOT NULL,
      reviewed_by varchar(100),
      review_note text,
      requested_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz
    );
  `);
}

export async function requestCreateReward(input: {
  title: string;
  description: string;
  pointsRequired: number;
  category: 'FEATURED' | 'MILESTONE';
  image?: Express.Multer.File;
  audit: AuditContext;
}) {
  await ensureRewardChangeRequestsTable();
  const trimmedTitle = input.title.trim();
  const trimmedDescription = input.description.trim();
  const pointsRequired = Number(input.pointsRequired);
  if (!Number.isInteger(pointsRequired) || pointsRequired <= 0) {
    throw new ApiError(400, 'INVALID_REWARD_POINTS', 'Reward points must be a positive integer.');
  }
  if (trimmedTitle.length < 2 || trimmedDescription.length < 3) {
    throw new ApiError(400, 'INVALID_REWARD_DETAILS', 'Reward title and description are required.');
  }

  let imageUrl: string | null = null;
  let storagePath: string | null = null;
  if (input.image) {
    await ensureRewardBucket();
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const extension = extensionByType[input.image.mimetype];
    if (!extension) throw new ApiError(400, 'INVALID_REWARD_IMAGE', 'Upload a JPG, PNG, or WebP image.');
    storagePath = `rewards/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(REWARD_BUCKET)
      .upload(storagePath, input.image.buffer, {
        contentType: input.image.mimetype,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) throw new ApiError(502, 'REWARD_IMAGE_UPLOAD_FAILED', 'The reward image could not be uploaded.');
    imageUrl = supabaseAdmin.storage.from(REWARD_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  }

  const changesSummary = `New ${input.category === 'FEATURED' ? 'Available Reward' : 'Milestone'}: "${trimmedTitle}" (${pointsRequired.toLocaleString('en-IN')} PTS)`;

  const result = await query<{ request_id: string }>(
    `INSERT INTO reward_change_requests (
       request_type, category, proposed_title, proposed_description, proposed_points,
       proposed_image_url, proposed_image_storage_path, changes_summary, requested_by
     ) VALUES ('CREATE', $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING request_id`,
    [input.category, trimmedTitle, trimmedDescription, pointsRequired, imageUrl, storagePath, changesSummary, input.audit.adminUsername],
  );

  return {
    requestId: result.rows[0]!.request_id,
    message: 'Change request submitted to Super Admin for approval.',
  };
}

export async function requestUpdateReward(input: {
  rewardId: string;
  title?: string;
  description?: string;
  pointsRequired?: number;
  image?: Express.Multer.File;
  audit: AuditContext;
}) {
  await ensureRewardChangeRequestsTable();
  const existingResult = await query<RewardRow>(
    `SELECT ${rewardColumns} FROM reward_catalog WHERE reward_id = $1 AND is_active = true LIMIT 1`,
    [input.rewardId],
  );
  const existing = existingResult.rows[0];
  if (!existing) throw new ApiError(404, 'REWARD_NOT_FOUND', 'Reward card not found.');

  const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const nextDescription = input.description !== undefined ? input.description.trim() : existing.description;
  if (nextTitle.length < 2 || nextDescription.length < 3) {
    throw new ApiError(400, 'INVALID_REWARD_DETAILS', 'Reward title and description are required.');
  }

  const nextPointsRequired = input.pointsRequired !== undefined ? Number(input.pointsRequired) : Number(existing.points_required);
  if (!Number.isInteger(nextPointsRequired) || nextPointsRequired <= 0) {
    throw new ApiError(400, 'INVALID_REWARD_POINTS', 'Reward points must be a positive integer.');
  }

  let newStoragePath: string | null = null;
  let imageUrl = existing.image_url;
  let imageUpdated = false;
  if (input.image) {
    await ensureRewardBucket();
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const extension = extensionByType[input.image.mimetype];
    if (!extension) throw new ApiError(400, 'INVALID_REWARD_IMAGE', 'Upload a JPG, PNG, or WebP image.');
    newStoragePath = `rewards/${input.rewardId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(REWARD_BUCKET)
      .upload(newStoragePath, input.image.buffer, {
        contentType: input.image.mimetype,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) throw new ApiError(502, 'REWARD_IMAGE_UPLOAD_FAILED', 'The reward image could not be uploaded.');
    imageUrl = supabaseAdmin.storage.from(REWARD_BUCKET).getPublicUrl(newStoragePath).data.publicUrl;
    imageUpdated = true;
  }

  const changes: string[] = [];
  if (Number(existing.points_required) !== nextPointsRequired) {
    changes.push(`Points: ${Number(existing.points_required).toLocaleString('en-IN')} -> ${nextPointsRequired.toLocaleString('en-IN')}`);
  }
  if (existing.title !== nextTitle) {
    changes.push(`Title: "${existing.title}" -> "${nextTitle}"`);
  }
  if (existing.description !== nextDescription) {
    changes.push('Description updated');
  }
  if (imageUpdated) {
    changes.push('Image updated');
  }
  const changesSummary = changes.length > 0 ? changes.join(', ') : 'Details updated';

  const result = await query<{ request_id: string }>(
    `INSERT INTO reward_change_requests (
       reward_id, request_type, category, proposed_title, proposed_description, proposed_points,
       proposed_image_url, proposed_image_storage_path, changes_summary, requested_by
     ) VALUES ($1, 'UPDATE', $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING request_id`,
    [input.rewardId, existing.category, nextTitle, nextDescription, nextPointsRequired, imageUrl, newStoragePath, changesSummary, input.audit.adminUsername],
  );

  return {
    requestId: result.rows[0]!.request_id,
    message: 'Change request submitted to Super Admin for approval.',
  };
}

export async function requestDeleteReward(input: {
  rewardId: string;
  audit: AuditContext;
}) {
  await ensureRewardChangeRequestsTable();
  const existingResult = await query<RewardRow>(
    `SELECT ${rewardColumns} FROM reward_catalog WHERE reward_id = $1 AND is_active = true LIMIT 1`,
    [input.rewardId],
  );
  const existing = existingResult.rows[0];
  if (!existing) throw new ApiError(404, 'REWARD_NOT_FOUND', 'Reward card not found.');

  const changesSummary = 'Deletion requested';

  const result = await query<{ request_id: string }>(
    `INSERT INTO reward_change_requests (
       reward_id, request_type, category, proposed_title, is_deletion, changes_summary, requested_by
     ) VALUES ($1, 'DELETE', $2, $3, true, $4, $5)
     RETURNING request_id`,
    [input.rewardId, existing.category, existing.title, changesSummary, input.audit.adminUsername],
  );

  return {
    requestId: result.rows[0]!.request_id,
    message: 'Change request submitted to Super Admin for approval.',
  };
}

export async function listRewardChangeRequests(status = 'PENDING') {
  await ensureRewardChangeRequestsTable();
  const statement = `
    SELECT req.request_id, req.reward_id, req.request_type, req.category, req.proposed_title,
           req.proposed_description, req.proposed_points, req.proposed_image_url,
           req.is_deletion, req.changes_summary, req.request_status, req.requested_by,
           req.reviewed_by, req.requested_at, req.reviewed_at,
           coalesce(cat.title, req.proposed_title, 'Reward') AS reward_name
    FROM reward_change_requests req
    LEFT JOIN reward_catalog cat ON cat.reward_id = req.reward_id
    WHERE ($1 = 'ALL' OR req.request_status = $1)
    ORDER BY req.requested_at DESC
  `;
  const result = await query<RewardChangeRequestRow & { reward_name: string }>(statement, [status]);

  return result.rows.map((row) => ({
    id: row.request_id,
    rewardId: row.reward_id,
    rewardName: row.reward_name,
    requestType: row.request_type,
    category: row.category,
    proposedTitle: row.proposed_title,
    proposedDescription: row.proposed_description,
    proposedPoints: row.proposed_points ? Number(row.proposed_points) : null,
    proposedImageUrl: row.proposed_image_url,
    isDeletion: row.is_deletion,
    changesSummary: row.changes_summary,
    status: row.request_status,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
  }));
}

export async function reviewRewardChangeRequest(input: {
  requestId: string;
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
  superAdminUsername: string;
  audit: AuditContext;
}) {
  await ensureRewardChangeRequestsTable();
  return withTransaction(async (client) => {
    const requestResult = await client.query<RewardChangeRequestRow>(
      `SELECT * FROM reward_change_requests WHERE request_id = $1 AND request_status = 'PENDING' FOR UPDATE`,
      [input.requestId],
    );
    const req = requestResult.rows[0];
    if (!req) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Reward change request not found or already reviewed.');
    }

    if (input.decision === 'REJECT') {
      await client.query(
        `UPDATE reward_change_requests
         SET request_status = 'REJECTED', reviewed_by = $1, reviewed_at = now(), review_note = $2
         WHERE request_id = $3`,
        [input.superAdminUsername, input.reviewNote || null, input.requestId],
      );
      await writeAdminAudit(client, {
        ...input.audit,
        action: 'REWARD_CHANGE_REJECTED',
        entityType: 'REWARD_CHANGE_REQUEST',
        entityId: input.requestId,
      });
      return { success: true, message: 'Reward change request rejected.' };
    }

    // APPROVE
    if (req.request_type === 'CREATE') {
      const nextOrderResult = await client.query<{ next_order: number }>(
        `SELECT coalesce(max(display_order), 0) + 1 AS next_order
         FROM reward_catalog WHERE category = $1`,
        [req.category],
      );
      const displayOrder = Number(nextOrderResult.rows[0]?.next_order ?? 1);
      const rewardCode = `${req.category}_${Date.now()}_${randomUUID().slice(0, 8)}`;

      await client.query(
        `INSERT INTO reward_catalog (
           reward_code, category, points_required, title, description, image_url, image_storage_path,
           display_order, updated_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          rewardCode, req.category, req.proposed_points, req.proposed_title,
          req.proposed_description, req.proposed_image_url, req.proposed_image_storage_path,
          displayOrder, input.superAdminUsername,
        ],
      );
    } else if (req.request_type === 'UPDATE' && req.reward_id) {
      await client.query(
        `UPDATE reward_catalog
         SET title = coalesce($1, title),
             description = coalesce($2, description),
             points_required = coalesce($3, points_required),
             image_url = coalesce($4, image_url),
             image_storage_path = coalesce($5, image_storage_path),
             updated_by = $6,
             updated_at = now()
         WHERE reward_id = $7`,
        [
          req.proposed_title, req.proposed_description, req.proposed_points,
          req.proposed_image_url, req.proposed_image_storage_path,
          input.superAdminUsername, req.reward_id,
        ],
      );
    } else if ((req.request_type === 'DELETE' || req.is_deletion) && req.reward_id) {
      await client.query(
        `UPDATE reward_catalog
         SET is_active = false, updated_by = $1, updated_at = now()
         WHERE reward_id = $2`,
        [input.superAdminUsername, req.reward_id],
      );
    }

    await client.query(
      `UPDATE reward_change_requests
       SET request_status = 'APPROVED', reviewed_by = $1, reviewed_at = now(), review_note = $2
       WHERE request_id = $3`,
      [input.superAdminUsername, input.reviewNote || null, input.requestId],
    );

    await writeAdminAudit(client, {
      ...input.audit,
      action: 'REWARD_CHANGE_APPROVED',
      entityType: 'REWARD_CHANGE_REQUEST',
      entityId: input.requestId,
    });

    return { success: true, message: 'Reward change request approved and applied to catalog.' };
  });
}
