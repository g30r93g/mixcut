export interface Track {
  id: string;
  job_id: string;
  track_number: number;
  title: string;
  performer: string | null;
  start_ms: number;
  duration_ms: number | null;
  output_key: string | null;
  created_at: string;
}
