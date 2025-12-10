// Note: See `shared/src/types/worker.ts` - Identical, but less hassle with it being here and not in shared
export interface WorkerMessage {
  jobId: string;
  audioBucket: string;
  audioKey: string;
  artworkBucket?: string;
  artworkKey?: string;
  cueBucket: string;
  cueKey: string;
}

export interface JobRow {
  id: string;
  status: string;
  output_bucket: string | null;
  output_prefix: string | null;
}

export interface JobTrackRow {
  id: string;
  job_id: string;
  track_number: number;
  title: string;
  output_key: string | null;
}

