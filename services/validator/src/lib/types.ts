import type { Job } from "@mixcut/shared";

export type JobRecord = Job;

export interface ValidatorEvent {
  jobId: string;
}
