import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import JSZip from "jszip";
import { JobStatus } from "@mixcut/shared";
import { badRequest, internalError, json, notFound } from "../lib/http";
import { supabase } from "../lib/supabase";

const s3 = new S3Client({});

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);

  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function handleBundleJob(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const jobId = event.pathParameters?.id;

  if (!jobId) {
    return badRequest("Missing job id");
  }

  try {
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return notFound("Job not found");
    }

    if (job.status !== JobStatus.COMPLETED) {
      return badRequest("Job is not completed yet");
    }

    const outputBucket = job.output_bucket;
    const outputPrefix = job.output_prefix || `jobs/${jobId}`;

    if (!outputBucket) {
      return badRequest("Job has no outputs yet");
    }

    const listResp = await s3.send(
      new ListObjectsV2Command({
        Bucket: outputBucket,
        Prefix: outputPrefix
      })
    );

    const objects = listResp.Contents?.filter(
      (obj) => obj.Key && !obj.Key.endsWith("/")
    );

    if (!objects || objects.length === 0) {
      return badRequest("No output files to bundle");
    }

    const zip = new JSZip();

    for (const obj of objects) {
      const key = obj.Key!;
      const getResp = await s3.send(
        new GetObjectCommand({
          Bucket: outputBucket,
          Key: key
        })
      );

      const buffer = await streamToBuffer(getResp.Body as any);
      const filename = key.replace(`${outputPrefix}/`, "");
      zip.file(filename, buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipKey = `${outputPrefix}/bundle.zip`;

    await s3.send(
      new PutObjectCommand({
        Bucket: outputBucket,
        Key: zipKey,
        Body: zipBuffer,
        ContentType: "application/zip"
      })
    );

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: outputBucket,
        Key: zipKey
      }),
      { expiresIn: 3600 }
    );

    return json(200, { url: signedUrl, key: zipKey });
  } catch (err: any) {
    console.error("handleBundleJob error", err);
    return internalError("Unexpected error bundling job outputs");
  }
}
