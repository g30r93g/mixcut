export interface JobRecord {
  id: string;
  status: string;
  audio_key: string;
  audio_bucket: string;
  cue_key: string;
  cue_bucket: string;
}

export interface ValidatorEvent {
  jobId: string;
}
