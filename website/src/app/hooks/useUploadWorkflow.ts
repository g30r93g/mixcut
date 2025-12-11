import { useCallback, useMemo, useState } from 'react';
import { retryWithBackoff } from '@/lib/retry-utils';
import { uploadToPresigned } from '@/lib/upload-utils';
import type { Stage } from '@/types/jobs';
import type { CreateJobResponse } from '@mixcut/shared';

const apiUrl = (path: string) => `/api${path}`;

type UseUploadWorkflowArgs = {
  audioFile: File | null;
  cueFile: File | null;
  artworkFile: File | null;
  cueValid: boolean | null;
  generateCueFile: () => File | null;
  setError: (value: string | null) => void;
};

export function useUploadWorkflow({
  audioFile,
  cueFile,
  artworkFile,
  cueValid,
  generateCueFile,
  setError,
}: UseUploadWorkflowArgs) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [audioProgress, setAudioProgress] = useState<number | null>(null);
  const [cueProgress, setCueProgress] = useState<number | null>(null);
  const [artworkProgress, setArtworkProgress] = useState<number | null>(null);

  const handleUpload = useCallback(async () => {
    if (!audioFile) {
      setError('Please select both an audio file and its matching .cue file.');
      return;
    }

    const latestCueFile = generateCueFile() ?? cueFile;
    if (!latestCueFile) {
      setError('Please select both an audio file and its matching .cue file.');
      return;
    }

    if (cueValid !== true) {
      setError('Invalid CUE sheet');
      return;
    }

    setError(null);
    setStage('creating');

    try {
      const createJobBody =
        artworkFile && artworkFile.type
          ? {
              artworkContentType: artworkFile.type,
            }
          : {};

      const response = await retryWithBackoff(() =>
        fetch(apiUrl('/jobs'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createJobBody),
        }),
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to create job');
      }

      const payload = (await response.json()) as CreateJobResponse;
      setJobId(payload.jobId);
      setStage('uploading');
      setAudioProgress(0);
      setCueProgress(0);
      setArtworkProgress(artworkFile ? 0 : null);

      if (artworkFile) {
        const artworkUrl = payload.uploadUrls.artwork;
        if (!artworkUrl) {
          throw new Error('Server did not return an artwork upload URL.');
        }
      }

      console.log('cue', await latestCueFile.text());

      const tasks: Promise<unknown>[] = [
        uploadToPresigned(payload.uploadUrls.cue, latestCueFile, 'text/plain', setCueProgress),
        uploadToPresigned(payload.uploadUrls.audio, audioFile, 'audio/mp4', setAudioProgress),
      ];

      if (artworkFile) {
        const artworkUrl = payload.uploadUrls.artwork;
        if (!artworkUrl) {
          throw new Error('Server did not return an artwork upload URL.');
        }
        tasks.push(uploadToPresigned(artworkUrl, artworkFile, 'image/png', setArtworkProgress));
      }

      await Promise.all(tasks);

      setStage('uploaded');
      setAudioProgress(100);
      setCueProgress(100);
      if (artworkFile) {
        setArtworkProgress(100);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setAudioProgress(null);
      setCueProgress(null);
      setArtworkProgress(null);
      setStage('idle');
    }
  }, [artworkFile, audioFile, cueFile, cueValid, generateCueFile, setError]);

  const handleStart = useCallback(async () => {
    if (!jobId) return;
    setError(null);
    setStage('starting');

    try {
      const response = await retryWithBackoff(() =>
        fetch(apiUrl(`/jobs/${jobId}/start`), {
          method: 'POST',
        }),
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to start processing');
      }

      setStage('started');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to start processing';
      setError(message);
      setStage('uploaded');
    }
  }, [jobId, setError]);

  const isBusy = stage === 'creating' || stage === 'uploading' || stage === 'starting';

  const actionLabel = useMemo(() => {
    if (stage === 'started') return 'Started';
    if (stage === 'uploaded') return 'Cut';
    if (stage === 'creating') return 'Creating job…';
    if (stage === 'uploading') return 'Uploading…';
    if (stage === 'starting') return 'Starting…';
    return 'Upload';
  }, [stage]);

  const actionDisabled = useMemo(() => {
    if (stage === 'uploaded') {
      return !jobId || isBusy;
    }

    return stage === 'started' || !audioFile || !cueFile || isBusy;
  }, [audioFile, cueFile, isBusy, jobId, stage]);

  return {
    jobId,
    stage,
    audioProgress,
    cueProgress,
    artworkProgress,
    actionLabel,
    actionDisabled,
    handleUpload,
    handleStart,
    setArtworkProgress,
  };
}
