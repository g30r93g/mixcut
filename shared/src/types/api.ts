import { Job } from './job';
import { Track } from './track';

export interface CreateJobResponse {
  jobId: string;
  uploadUrls: {
    audio: string;
    cue: string;
  };
}

export interface JobStatusResponse {
  job: Job;
  tracks: Track[];
}

export interface StartJobResponse {
  ok: boolean;
}
