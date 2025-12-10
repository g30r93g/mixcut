import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { CreateJobResponse } from "@mixcut/shared";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { badRequest, internalError, json } from "../lib/http";
import { supabase } from "../lib/supabase";

const s3 = new S3Client({});

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
if (!UPLOADS_BUCKET) {
  throw new Error("UPLOADS_BUCKET must be set");
}

type ArtworkType = { contentType: string, extension: string };
const artworkTypeMap: Record<string, ArtworkType> = {
  "image/png": { contentType: "image/png", extension: "png" },
  "image/jpeg": { contentType: "image/jpeg", extension: "jpg" },
  "image/jpg": { contentType: "image/jpeg", extension: "jpg" }
};

export async function handleCreateJob(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let requestedArtworkType: ArtworkType | null = null;

    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        if (body?.artworkContentType) {
          const entry = artworkTypeMap[body.artworkContentType];
          if (!entry) {
            return badRequest("Unsupported artwork content type");
          }
          requestedArtworkType = entry;
        }
      } catch (err) {
        console.error("Invalid create job payload", err);
        return badRequest("Invalid request body");
      }
    }

    const jobId = randomUUID();
    const prefix = `raw/${jobId}`;

    const audioKey = `${prefix}/source.m4a`;
    const cueKey = `${prefix}/source.cue`;
    const artworkKey = requestedArtworkType ? `${prefix}/artwork.${requestedArtworkType.extension}` : undefined;

    const { error: insertErr } = await supabase.from("jobs").insert({
      id: jobId,
      status: "PENDING_UPLOAD",
      audio_bucket: UPLOADS_BUCKET,
      audio_key: audioKey,
      cue_bucket: UPLOADS_BUCKET,
      cue_key: cueKey
    });

    if (insertErr) {
      console.error("Failed to insert job", insertErr);
      return internalError("Failed to create job");
    }

    const [audioUrl, artworkUrl, cueUrl] = await Promise.all([
      getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: UPLOADS_BUCKET,
          Key: audioKey,
          ContentType: "audio/mp4" // m4a
        }),
        { expiresIn: 3600 }
      ),
      (requestedArtworkType && artworkKey) ? getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: UPLOADS_BUCKET,
          Key: artworkKey,
          ContentType: requestedArtworkType.contentType
        }),
        { expiresIn: 3600 }
      ) : undefined,
      getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: UPLOADS_BUCKET,
          Key: cueKey,
          ContentType: "text/plain"
        }),
        { expiresIn: 3600 }
      )
    ]);

    const payload: CreateJobResponse = {
      jobId,
      uploadUrls: {
        audio: audioUrl,
        artwork: artworkUrl,
        cue: cueUrl
      }
    };

    return json(201, payload);
  } catch (err: any) {
    console.error("handleCreateJob error", err);
    return internalError("Unexpected error creating job");
  }
}
