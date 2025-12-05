'use client';

import { ConfirmUpload } from '@/components/confirm-upload';
import { SelectSource, SourceType } from '@/components/select-source';
import { TracklistEditor, type CueTrackEntry } from '@/components/tracklist-editor';
import { retryWithBackoff } from '@/lib/retry-utils';
import { Stage } from '@/types/jobs';
import { parseCue, validateCue } from '@mixcut/parser';
import type { CreateJobResponse } from '@mixcut/shared';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const apiUrl = (path: string) => `/api${path}`;

async function uploadToPresigned(
  url: string,
  file: File,
  fallbackType: string,
  onProgress?: (percent: number) => void,
) {
  const contentType = file.type || fallbackType;

  const attemptUpload = () =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onerror = () => reject(new Error('Network error uploading file'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.send(file);
    });

  await retryWithBackoff(attemptUpload);
}

export default function UploadPage() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceType>('local');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [playerUrl, setPlayerUrl] = useState<string | undefined>(undefined);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [cueFile, setCueFile] = useState<File | null>(null);
  const [tracks, setTracks] = useState<CueTrackEntry[]>([]);
  const [currentMs, setCurrentMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cueValid, setCueValid] = useState<boolean | null>(null);
  const [audioProgress, setAudioProgress] = useState<number | null>(null);
  const [cueProgress, setCueProgress] = useState<number | null>(null);

  const isBusy = stage === 'creating' || stage === 'uploading' || stage === 'starting';

  useEffect(() => {
    const runValidation = () => {
      if (!cueFile && tracks.length === 0) {
        setCueValid(null);
        return;
      }

      try {
        const parsed = { fileName: cueFile?.name, tracks };
        const validation = validateCue(parsed);
        if (!validation.ok) {
          throw new Error(validation.error || 'Invalid CUE sheet');
        }
        setCueValid(true);
        setError(null);
      } catch (err: unknown) {
        setCueValid(false);
        const message = err instanceof Error ? err.message : 'Invalid CUE sheet';
        setError(message);
      }
    };

    runValidation();
  }, [cueFile, tracks]);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setPlayerUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [audioFile]);

  useEffect(() => {
    if (sourceType !== 'local') {
      setPlayerUrl(sourceUrl);
    } else if (!audioFile) {
      setPlayerUrl('');
    }
  }, [sourceType, sourceUrl, audioFile]);

  const handleUpload = useCallback(async () => {
    if (sourceType !== 'local') {
      setError('Remote downloads will be wired soon. Use a local file for now.');
      return;
    }

    if (!audioFile || !cueFile) {
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
      const response = await retryWithBackoff(() =>
        fetch(apiUrl('/jobs'), {
          method: 'POST',
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

      await Promise.all([
        uploadToPresigned(payload.uploadUrls.audio, audioFile, 'audio/mp4', setAudioProgress),
        uploadToPresigned(payload.uploadUrls.cue, cueFile, 'text/plain', setCueProgress),
      ]);

      setStage('uploaded');
      setAudioProgress(100);
      setCueProgress(100);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setAudioProgress(null);
      setCueProgress(null);
      setStage('idle');
    }
  }, [audioFile, cueFile, cueValid, sourceType]);

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

      router.push(`/job/${jobId}`);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to start processing';
      setError(message);
      setStage('uploaded');
    }
  }, [jobId, router]);

  const actionLabel = useMemo(() => {
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

    return sourceType === 'local'
      ? !audioFile || !cueFile || isBusy
      : isBusy; // remote flow will be enabled later
  }, [audioFile, cueFile, jobId, isBusy, stage, sourceType]);

  const onAction = stage === 'uploaded' ? handleStart : handleUpload;

  const handleCueDrop = useCallback(async (files: File[]) => {
    const next = files[0];
    if (!next) return;

    setCueFile(next);
    try {
      const text = await next.text();
      const parsed = parseCue(text);
      setTracks(parsed.tracks);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse CUE file';
      setError(message);
      setTracks([]);
    }
  }, []);

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.trackNumber - b.trackNumber),
    [tracks],
  );

  const activeTrack = useMemo(() => {
    const ms = currentMs;
    let current: CueTrackEntry | null = null;
    for (let i = 0; i < sortedTracks.length; i++) {
      const t = sortedTracks[i];
      const nextStart = sortedTracks[i + 1]?.startMs ?? durationMs;
      if (ms >= t.startMs && ms < nextStart) {
        current = t;
        break;
      }
      if (i === sortedTracks.length - 1 && ms >= t.startMs) {
        current = t;
      }
    }
    return current;
  }, [currentMs, sortedTracks, durationMs]);

  const formatTime = (ms: number) => {
    if (!Number.isFinite(ms)) return '--:--';
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const addTrack = useCallback(() => {
    const nextNumber =
      sortedTracks.length > 0
        ? Math.max(...sortedTracks.map((t) => t.trackNumber)) + 1
        : 1;
    const lastStart = sortedTracks[sortedTracks.length - 1]?.startMs ?? 0;
    const nextStart = lastStart + 60_000;
    setTracks((prev) => [
      ...prev,
      {
        trackNumber: nextNumber,
        title: `Track ${nextNumber}`,
        performer: 'Artist',
        startMs: nextStart,
      },
    ]);
  }, [sortedTracks]);

  const updateTrack = useCallback(
    (index: number, patch: Partial<CueTrackEntry>) => {
      setTracks((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    [],
  );

  const removeTrack = useCallback((index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const trackProgressPercent = (startMs: number, nextStartMs: number | undefined) => {
    const windowEnd = nextStartMs ?? durationMs;
    if (!Number.isFinite(windowEnd) || windowEnd <= startMs) return 0;
    if (currentMs < startMs) return 0;
    const clamped = Math.min(currentMs, windowEnd);
    return Math.min(100, ((clamped - startMs) / (windowEnd - startMs)) * 100);
  };

  const handleSourceSelect = (type: SourceType) => {
    setSourceType(type);
    setError(null);
    if (type !== 'local') {
      setAudioFile(null);
    }
  };

  const handleLocalAudioDrop = (files: File[]) => {
    const next = files[0];
    if (!next) return;
    setSourceType('local');
    setAudioFile(next);
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <SelectSource sourceType={sourceType} isBusy={isBusy} onSelect={handleSourceSelect} />

      <TracklistEditor
        sourceType={sourceType}
        sourceUrl={sourceUrl}
        onSourceUrlChange={setSourceUrl}
        playerUrl={playerUrl}
        isBusy={isBusy}
        audioFile={audioFile}
        audioProgress={audioProgress}
        onLocalAudioDrop={handleLocalAudioDrop}
        onPlayerDuration={setDurationMs}
        onPlayerProgress={setCurrentMs}
        currentMs={currentMs}
        durationMs={durationMs}
        formatTime={formatTime}
        cueFile={cueFile}
        cueProgress={cueProgress}
        onCueDrop={handleCueDrop}
        tracks={tracks}
        activeTrack={activeTrack}
        trackProgressPercent={trackProgressPercent}
        onUpdateTrack={updateTrack}
        onRemoveTrack={removeTrack}
        onAddTrack={addTrack}
      />

      <ConfirmUpload
        sourceType={sourceType}
        jobId={jobId}
        cueValid={cueValid}
        isBusy={isBusy}
        actionDisabled={actionDisabled}
        actionLabel={actionLabel}
        onAction={onAction}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
          <AlertTriangle className="size-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </main>
  );
}
