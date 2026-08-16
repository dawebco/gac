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
       FROM reward_catalog WHERE category = $1 AND is_active = true`,
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
