import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { parseCue, validateCue } from "@mixcut/parser";
import { supabase } from "./lib/supabase";
import { ValidatorEvent } from "./lib/types";

const s3 = new S3Client({});
const sqs = new SQSClient({});

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET!;
const JOBS_QUEUE_URL = process.env.JOBS_QUEUE_URL!;

export const handler = async (event: ValidatorEvent) => {
  const { jobId } = event;

  try {
    // 1. Load job from Supabase
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      throw new Error("Job not found in Supabase");
    }

    // 2. Fetch CUE file from S3
    const cueObject = await s3.send(
      new GetObjectCommand({
        Bucket: job.cue_bucket,
        Key: job.cue_key
      })
    );

    const cueText = await cueObject.Body!.transformToString();

    // 3. Parse and validate CUE
    const parsed = parseCue(cueText);
    const validation = validateCue(parsed);

    if (!validation.ok) {
      await failJob(jobId, validation.error);
      return;
    }

    // 4. Insert track metadata into job_tracks
    const tracks = validation.tracks; // array from parser

    const insertPayload = tracks.map((t) => ({
      job_id: jobId,
      track_number: t.trackNumber,
      title: t.title,
      performer: t.performer ?? null,
      start_ms: t.startMs
    }));

    const { error: insertErr } = await supabase
      .from("job_tracks")
      .insert(insertPayload);

    if (insertErr) {
      throw insertErr;
    }

    // 5. Enqueue worker job
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: JOBS_QUEUE_URL,
        MessageBody: JSON.stringify({
          jobId,
          audioBucket: job.audio_bucket,
          audioKey: job.audio_key,
          cueBucket: job.cue_bucket,
          cueKey: job.cue_key
        })
      })
    );

    // 6. Update job status → QUEUED
    await updateJob(jobId, {
      status: "QUEUED"
    });

    return { ok: true };
  } catch (err: any) {
    await failJob(event.jobId, err.message);
    return { ok: false, error: err.message };
  }
};

/** Helpers */
async function updateJob(jobId: string, patch: Record<string, any>) {
  const { error } = await supabase
    .from("jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) throw error;
}

async function failJob(jobId: string, message: string) {
  await updateJob(jobId, {
    status: "FAILED",
    error_message: message
  });
}
