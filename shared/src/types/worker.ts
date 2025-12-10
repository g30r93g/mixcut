export interface WorkerMessage {
  jobId: string;
  audioBucket: string;
  audioKey: string;
  artworkBucket?: string;
  artworkKey?: string;
  cueBucket: string;
  cueKey: string;
}
