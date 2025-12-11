export enum JobStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  VALIDATING = 'VALIDATING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Job {
  id: string;
  user_id: string | null;
  status: JobStatus;
  audio_bucket: string;
  audio_key: string;
  cue_bucket: string;
  cue_key: string;
  output_bucket: string | null;
  output_prefix: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
