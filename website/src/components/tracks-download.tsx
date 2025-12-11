'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobStatusResponse, Track } from '@mixcut/shared';
import { JobStatus } from '@mixcut/shared';
import { AlertTriangle, CheckCircle2, Clock, Download as DownloadIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const pollIntervalMs = 1000;

const statusCopy: Record<JobStatus, string> = {
  [JobStatus.PENDING_UPLOAD]: 'Waiting for upload',
  [JobStatus.VALIDATING]: 'Validating CUE sheet',
  [JobStatus.QUEUED]: 'Queued for cutting',
  [JobStatus.PROCESSING]: 'Processing tracks',
  [JobStatus.COMPLETED]: 'Completed',
  [JobStatus.FAILED]: 'Failed',
};

const statusClass = (label: string) => {
  switch (label) {
    case 'Completed':
      return 'text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50';
    case 'Failed':
      return 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/50';
    case 'Validating':
    case 'Processing':
      return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50';
    case 'Queued':
      return 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50';
    default:
      return 'text-muted-foreground bg-accent/50 dark:text-slate-200 dark:bg-slate-800/70';
  }
};

const apiUrl = (path: string) => `/api${path}`;

const trackStatus = (jobStatus: JobStatus, track: Track) => {
  if (jobStatus === JobStatus.FAILED) return 'Failed';
  if (track.output_key) return 'Completed';

  switch (jobStatus) {
    case JobStatus.VALIDATING:
      return 'Validating';
    case JobStatus.QUEUED:
      return 'Queued';
    case JobStatus.PROCESSING:
      return 'Processing';
    default:
      return 'Pending';
  }
};

export type TracksDownloadProps = {
  jobId: string | null;
};

export function TracksDownload({ jobId }: TracksDownloadProps) {
  const [jobState, setJobState] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;
    try {
      const response = await fetch(apiUrl(`/jobs/${jobId}`));

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to load job');
      }

      const payload = (await response.json()) as JobStatusResponse;
      setJobState(payload);
      setError(null);
      setIsLoading(false);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to load job';
      setError(message);
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!jobId || jobState?.job.status === JobStatus.COMPLETED || jobState?.job.status === JobStatus.FAILED) {
      return;
    }

    const timer = setInterval(() => {
      fetchStatus();
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [fetchStatus, jobState?.job.status, jobId]);

  const allDone = useMemo(() => {
    if (!jobState) return false;
    return jobState.job.status === JobStatus.COMPLETED && jobState.tracks.every((track) => Boolean(track.output_key));
  }, [jobState]);

  const downloadTracks = useCallback(async () => {
    if (!jobState) return;
    setIsDownloading(true);

    try {
      const response = await fetch(apiUrl(`/jobs/${jobState.job.id}/bundle`));
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to create download bundle');
      }

      const payload = (await response.json()) as { url: string };
      if (payload.url) {
        window.location.href = payload.url;
      } else {
        throw new Error('Missing bundle URL');
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to download tracks';
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  }, [jobState]);

  if (!jobId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Download tracks</CardTitle>
          <CardDescription>Provide a job ID to view track progress.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading && !jobState) {
    return (
      <main className="flex h-full items-center justify-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error && !jobState) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="size-4" />
          <p className="text-sm">{error}</p>
        </div>
      </main>
    );
  }

  const jobStatusLabel = jobState ? statusCopy[jobState.job.status] : '';
  const terminal = jobState?.job.status === JobStatus.COMPLETED || jobState?.job.status === JobStatus.FAILED;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-2xl">Job {jobId}</CardTitle>
          <CardDescription>{jobStatusLabel}</CardDescription>
        </div>
        {jobState?.job.status === JobStatus.FAILED && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            <span className="text-sm">{jobState.job.error_message ?? 'Something went wrong.'}</span>
          </div>
        )}
        {allDone && (
          <Button disabled={isDownloading} onClick={downloadTracks} size="lg">
            {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
            Download tracks
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!terminal && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            Polling for updates…
          </div>
        )}

        {error && jobState && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="size-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Performer</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobState?.tracks.map((track) => {
                const label = trackStatus(jobState.job.status, track);
                return (
                  <tr key={track.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">{track.track_number}</td>
                    <td className="px-4 py-3 align-top">{track.title}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{track.performer ?? '—'}</td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                          label,
                        )}`}
                      >
                        {label === 'Completed' ? (
                          <CheckCircle2 className="size-3" />
                        ) : label === 'Failed' ? (
                          <AlertTriangle className="size-3" />
                        ) : (
                          <Loader2 className="size-3 animate-spin" />
                        )}
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
