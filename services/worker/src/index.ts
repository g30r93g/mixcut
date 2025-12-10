import type { SQSEvent, SQSRecord } from "aws-lambda";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

import { downloadToFile, listFiles, uploadFile } from "./lib/fs-utils";
import { supabase } from "./lib/supabase";
import { JobTrackRow, WorkerMessage } from "./lib/types";

const execFileAsync = promisify(execFile);

const OUTPUTS_BUCKET = process.env.OUTPUTS_BUCKET!;
if (!OUTPUTS_BUCKET) {
  throw new Error("OUTPUTS_BUCKET must be set");
}

export const handler = async (event: SQSEvent) => {
  // We configured batchSize: 1, but let's be safe and loop
  for (const record of event.Records) {
    await handleRecord(record);
  }
};

async function handleRecord(record: SQSRecord) {
  const msg: WorkerMessage = JSON.parse(record.body);

  const { jobId, audioBucket, audioKey, artworkBucket, artworkKey, cueBucket, cueKey } = msg;

  try {
    // 1) Mark job PROCESSING
    await updateJob(jobId, {
      status: "PROCESSING"
    });

    // 2) Prepare working directory in /tmp
    const workDir = path.join("/tmp", `job-${jobId}`);
    await fs.rm(workDir, { recursive: true, force: true });
    await fs.mkdir(workDir, { recursive: true });

    const audioPath = path.join(workDir, "source.m4a");
    const cuePath = path.join(workDir, "source.cue");

    // 3) Download source files
    await Promise.all([
      downloadToFile(audioBucket, audioKey, audioPath),
      downloadToFile(cueBucket, cueKey, cuePath)
    ]);

    // 4) Run m4acut in that directory
    // m4acut will emit track files in the current working directory
    await execFileAsync("m4acut", ["-C", cuePath, audioPath], {
      cwd: workDir
    });

    // 5) List output .m4a files (excluding source.m4a)
    const allFiles = await listFiles(workDir);
    const outputFiles = allFiles
      .filter((p) => p.endsWith(".m4a") && !p.endsWith("source.m4a"))
      .sort(); // rely on m4acut naming order (usually track order)


    // 6) Apply metadata
    // 6.1) Artwork
    if (artworkBucket && artworkKey) {
      const artworkPath = await downloadArtworkForJob(artworkBucket, artworkKey, workDir);

      if (artworkPath) {
        await applyArtworkToFiles(outputFiles, artworkPath);
      }
    }

    const cueMetadata = await readCueMetadata(cuePath);

    // 6.2) Genre
    if (cueMetadata.genre) {
      await applyAtomicParsleyMetadata(outputFiles, "--genre", cueMetadata.genre);
    }

    // 6.3) Release Year
    if (cueMetadata.releaseYear) {
      await applyAtomicParsleyMetadata(outputFiles, "--year", cueMetadata.releaseYear);
    }

    // 7) Load existing tracks for job from Supabase
    const { data: tracks, error: tracksErr } = await supabase
      .from("job_tracks")
      .select("*")
      .eq("job_id", jobId)
      .order("track_number", { ascending: true });

    if (tracksErr) {
      throw tracksErr;
    }

    const typedTracks = (tracks ?? []) as JobTrackRow[];

    if (typedTracks.length !== outputFiles.length) {
      throw new Error(
        `Track count mismatch: have ${typedTracks.length} tracks but ${outputFiles.length} output files`
      );
    }

    const outputPrefix = `jobs/${jobId}`;

    // 8) Upload each file and update tracks
    for (let i = 0; i < typedTracks.length; i++) {
      const track = typedTracks[i];
      const filePath = outputFiles[i];
      const fileName = path.basename(filePath);

      const outKey = `${outputPrefix}/${fileName}`;

      await uploadFile(OUTPUTS_BUCKET, outKey, filePath);

      const { error: updateTrackErr } = await supabase
        .from("job_tracks")
        .update({
          output_key: outKey
        })
        .eq("id", track.id);

      if (updateTrackErr) throw updateTrackErr;
    }

    // 9) TODO: Run `/Users/g30r93g/Projects/mixcut/services/api/src/handlers/bundle-job.ts` automatically to make ready for download. Then complete

    // 10) Mark job COMPLETED, saving output location
    await updateJob(jobId, {
      status: "COMPLETED",
      output_bucket: OUTPUTS_BUCKET,
      output_prefix: outputPrefix
    });
  } catch (err: any) {
    console.error("Worker error for job", jobId, err);
    await updateJob(jobId, {
      status: "FAILED",
      error_message: err?.message ?? "Unknown error in worker"
    });

    // Let the Lambda succeed, so SQS doesn't keep retrying forever.
    // If you want retries, rethrow here instead.
  } finally {
    // Best-effort clean up
    const workDir = path.join("/tmp", `job-${jobId}`);
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function updateJob(jobId: string, patch: Record<string, any>) {
  const { error } = await supabase
    .from("jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) {
    throw error;
  }
}

const ARTWORK_FILENAMES = ["artwork.png", "artwork.jpg", "artwork.jpeg"];

async function downloadArtworkForJob(
  bucket: string,
  audioKey: string,
  workDir: string
): Promise<string | null> {
  const prefix = path.posix.dirname(audioKey);

  for (const filename of ARTWORK_FILENAMES) {
    const key = prefix && prefix !== "." ? `${prefix}/${filename}` : filename;
    const localPath = path.join(workDir, filename);

    try {
      await downloadToFile(bucket, key, localPath);
      return localPath;
    } catch (err: any) {
      if (isNotFoundError(err)) {
        continue;
      }
      throw err;
    }
  }

  return null;
}

async function applyArtworkToFiles(filePaths: string[], artworkPath: string) {
  for (const filePath of filePaths) {
    await execFileAsync("AtomicParsley", [filePath, "--artwork", artworkPath, "--overWrite"], {
      cwd: path.dirname(filePath)
    });
  }
}

type CueMetadata = {
  genre?: string;
  releaseYear?: string;
};

async function readCueMetadata(cuePath: string): Promise<CueMetadata> {
  const metadata: CueMetadata = {};
  const contents = await fs.readFile(cuePath, "utf8");

  const genreMatch = contents.match(/REM\s+GENRE\s+"([^"]+)"/i);
  if (genreMatch?.[1]) {
    metadata.genre = genreMatch[1].trim();
  }

  const dateMatch = contents.match(/REM\s+DATE\s+"([^"]+)"/i);
  if (dateMatch?.[1]) {
    metadata.releaseYear = dateMatch[1].trim();
  }

  return metadata;
}

async function applyAtomicParsleyMetadata(filePaths: string[], flag: string, value: string) {
  for (const filePath of filePaths) {
    await execFileAsync("AtomicParsley", [filePath, flag, value, "--overWrite"], {
      cwd: path.dirname(filePath)
    });
  }
}

function isNotFoundError(err: any): boolean {
  if (!err) return false;
  if (err.$metadata?.httpStatusCode === 404) {
    return true;
  }
  const code = err.Code ?? err.code ?? err.name;
  return code === "NoSuchKey" || code === "NotFound";
}
