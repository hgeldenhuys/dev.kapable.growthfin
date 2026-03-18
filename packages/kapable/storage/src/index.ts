/**
 * @kapable/storage — S3/MinIO object storage for Kapable apps.
 *
 * Usage:
 *   import { storage } from '@kapable/storage';
 *   const { data } = await storage.presignUpload('uploads/photo.jpg');
 */

import { platformFetch } from '@kapable/internal';
import type { PlatformResponse } from '@kapable/internal';

export type { PlatformResponse };

export interface PresignUploadOptions {
  contentType?: string;
  expiresIn?: number;
}

export const storage = {
  async presignUpload(
    key: string,
    options?: PresignUploadOptions,
  ): Promise<PlatformResponse<{ presignedUrl: string; publicUrl: string }>> {
    return platformFetch('/v1/storage/presign', {
      key,
      contentType: options?.contentType || 'application/octet-stream',
      expiresIn: options?.expiresIn || 3600,
    });
  },
};
