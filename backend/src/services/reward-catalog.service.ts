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

export async function updateReward(input: {
  rewardId: string;
  title: string;
  description: string;
  image?: Express.Multer.File;
  audit: AuditContext;
}) {
  const existingResult = await query<RewardRow>(
    `SELECT ${rewardColumns} FROM reward_catalog WHERE reward_id = $1 AND is_active = true LIMIT 1`,
    [input.rewardId],
  );
  const existing = existingResult.rows[0];
  if (!existing) throw new ApiError(404, 'REWARD_NOT_FOUND', 'Reward card not found.');

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
         SET title = $1, description = $2, image_url = $3,
             image_storage_path = coalesce($4, image_storage_path), updated_by = $5
         WHERE reward_id = $6
         RETURNING ${rewardColumns}`,
        [input.title.trim(), input.description.trim(), imageUrl, newStoragePath, input.audit.adminUsername, input.rewardId],
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
