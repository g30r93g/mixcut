import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { createReadStream, mkdtempSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join, basename } from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

interface DownloadEvent {
  url: string;
  keyPrefix?: string;
  fileName?: string;
}

interface DownloadResult {
  bucket: string;
  key: string;
  bytes: number;
}

const s3 = new S3Client({});
const AUDIO_DOWNLOADS_BUCKET = process.env.AUDIO_DOWNLOADS_BUCKET;

function ensureBucketEnv(): string {
  if (!AUDIO_DOWNLOADS_BUCKET) {
    throw new Error("Missing AUDIO_DOWNLOADS_BUCKET env var");
  }
  return AUDIO_DOWNLOADS_BUCKET;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/]/g, "_");
}

async function downloadWithYtDlp(url: string): Promise<{ filePath: string; workdir: string; }> {
  const workdir = mkdtempSync(join(tmpdir(), "yt-dlp-"));
  const outputTemplate = join(workdir, "%(id)s.%(ext)s");

  const args = [
    "--no-playlist",
    "--newline",
    "-f",
    "bestaudio[ext=m4a]/bestaudio[acodec^=opus]/bestaudio/best",
    "-o",
    outputTemplate,
    "--print",
    "after_move:filepath",
    url
  ];

  console.log("Starting yt-dlp", { url, args });
  const child: ChildProcessWithoutNullStreams = spawn("yt-dlp", args, {
    env: {
      ...process.env
    }
  });

  let filePath: string | undefined;

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    text
      .trim()
      .split(/\n/)
      .filter(Boolean)
      .forEach((line) => {
        if (line.startsWith("[download]")) {
          console.log(line);
        } else if (!filePath && !line.startsWith("[")) {
          // after_move:filepath outputs raw path without prefix
          filePath = line.trim();
        } else {
          console.log(line);
        }
      });
  });

  child.stderr.on("data", (chunk: Buffer) => {
    console.error(chunk.toString());
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`yt-dlp exited with code ${exitCode}`);
  }

  if (!filePath) {
    throw new Error("yt-dlp did not emit a file path");
  }

  return { filePath, workdir };
}

async function uploadToS3(localPath: string, opts: { keyPrefix?: string; fileName?: string; bucket: string; }): Promise<DownloadResult> {
  const { keyPrefix, fileName, bucket } = opts;
  const resolvedName = sanitizeFileName(fileName ?? basename(localPath));
  const keyParts = [keyPrefix?.replace(/\/$/, ""), resolvedName].filter(Boolean) as string[];
  const key = keyParts.join("/");

  const bodyStream = createReadStream(localPath);
  const stats = statSync(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bodyStream
    })
  );

  return { bucket, key, bytes: stats.size };
}

async function performDownload(event: DownloadEvent): Promise<DownloadResult> {
  const bucket = ensureBucketEnv();
  if (!event.url || typeof event.url !== "string") {
    throw new Error("Missing url in request");
  }

  const { filePath, workdir } = await downloadWithYtDlp(event.url);
  try {
    const result = await uploadToS3(filePath, {
      bucket,
      keyPrefix: event.keyPrefix ?? randomUUID(),
      fileName: event.fileName
    });
    console.log("Uploaded to S3", result);
    return result;
  } finally {
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Failed to clean temp dir", cleanupErr);
    }
  }
}

function httpResponse(statusCode: number, body: Record<string, any>): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST"
    },
    body: JSON.stringify(body)
  };
}

export async function handler(
  event: APIGatewayProxyEvent | DownloadEvent
): Promise<APIGatewayProxyResult | DownloadResult> {
  // Direct invocation (non-HTTP)
  if ((event as any).url && !(event as any).httpMethod) {
    return performDownload(event as DownloadEvent);
  }

  const httpEvent = event as APIGatewayProxyEvent;
  if (httpEvent.httpMethod === "OPTIONS") {
    return httpResponse(200, {});
  }

  if (httpEvent.httpMethod !== "POST") {
    return httpResponse(405, { error: "Method not allowed" });
  }

  if (!httpEvent.body) {
    return httpResponse(400, { error: "Missing body" });
  }

  try {
    const parsed = JSON.parse(httpEvent.body);
    const url = parsed.url as string | undefined;
    const keyPrefix = parsed.keyPrefix as string | undefined;
    const fileName = parsed.fileName as string | undefined;

    const result = await performDownload({ url, keyPrefix, fileName });
    return httpResponse(200, result);
  } catch (err: any) {
    console.error("Download failed", err);
    return httpResponse(500, { error: err.message || "Download failed" });
  }
}
