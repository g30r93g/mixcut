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

