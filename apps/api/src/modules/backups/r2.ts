import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error.js';

export function backupsConfigured(): boolean {
  return !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.BACKUP_ENCRYPTION_KEY);
}

function assertConfigured() {
  if (!backupsConfigured()) throw new AppError('Backups are not configured on this server yet.', 503);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
      // Newer AWS SDK v3 defaults add checksum trailers R2 doesn't support, which R2
      // rejects as a plain 403 AccessDenied — restore the pre-checksum-era behavior.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return client;
}

// Derives a proper 32-byte AES-256 key from the configured passphrase — same idea as
// CNIC_HASH_PEPPER: the operator picks one long secret, it doesn't need to be exactly
// 32 raw bytes. Never rotate this casually — old backups need the old key to restore.
function encryptionKey(): Buffer {
  return createHash('sha256').update(env.BACKUP_ENCRYPTION_KEY!).digest();
}

const IV_LEN = 12;
const TAG_LEN = 16;

function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

function decryptBuffer(blob: Buffer): Buffer {
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Uploads a JSON-serializable snapshot: gzip, then AES-256-GCM on top of R2's own
// at-rest encryption, so a leaked R2 token alone can't read a shop's data.
export async function uploadBackupObject(key: string, snapshot: unknown): Promise<{ sizeBytes: number }> {
  assertConfigured();
  const json = Buffer.from(JSON.stringify(snapshot), 'utf8');
  const encrypted = encryptBuffer(gzipSync(json));
  await s3().send(new PutObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
    Body: encrypted,
    ContentType: 'application/octet-stream',
  }));
  return { sizeBytes: encrypted.length };
}

// Returns the decrypted, decompressed JSON buffer — caller decides whether to
// JSON.parse it (restore) or stream it to a client as-is (download).
export async function fetchBackupBuffer(key: string): Promise<Buffer> {
  assertConfigured();
  const res = await s3().send(new GetObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
  return gunzipSync(decryptBuffer(Buffer.concat(chunks)));
}

export interface BackupObjectInfo {
  key: string;
  sizeBytes: number;
  lastModified: Date;
}

export async function listBackupObjects(prefix: string): Promise<BackupObjectInfo[]> {
  assertConfigured();
  const out: BackupObjectInfo[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3().send(new ListObjectsV2Command({
      Bucket: env.R2_BUCKET!,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.Size != null && obj.LastModified) {
        out.push({ key: obj.Key, sizeBytes: obj.Size, lastModified: obj.LastModified });
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

export async function deleteBackupObject(key: string): Promise<void> {
  assertConfigured();
  await s3().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
}
