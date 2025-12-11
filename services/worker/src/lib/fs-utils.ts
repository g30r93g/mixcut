import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const s3 = new S3Client({});

export async function downloadToFile(bucket: string, key: string, destPath: string): Promise<void> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  const body = await res.Body!.transformToByteArray();
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, body);
}

export async function uploadFile(bucket: string, key: string, sourcePath: string): Promise<void> {
  const body = await fs.readFile(sourcePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
    }),
  );
}

/**
 * List files in a directory, returning absolute paths.
 */
export async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => path.join(dir, e.name));
}
