'use client';

import { ConfirmUpload } from '@/components/confirm-upload';
import { SelectSource, SourceType } from '@/components/select-source';
import { TracklistEditor, type CueTrackEntry, type OverallDetails } from '@/components/tracklist-editor';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { retryWithBackoff } from '@/lib/retry-utils';
import { Stage } from '@/types/jobs';
import { parseCue, validateCue } from '@mixcut/parser';
import type { CreateJobResponse } from '@mixcut/shared';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const apiUrl = (path: string) => `/api${path}`;

const emptyOverallDetails: OverallDetails = {
  title: '',
  performer: '',
  genre: '',
  releaseYear: '',
};

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
  const [overallDetails, setOverallDetails] = useState<OverallDetails>(emptyOverallDetails);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkProgress, setArtworkProgress] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cueValid, setCueValid] = useState<boolean | null>(null);
  const [audioProgress, setAudioProgress] = useState<number | null>(null);
  const [cueProgress, setCueProgress] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const resetCueContent = useCallback(() => {
    setCueFile(null);
    setTracks([]);
    setCueValid(null);
    setOverallDetails({ ...emptyOverallDetails });
    setArtworkFile(null);
    setArtworkProgress(null);
  }, []);

  const isBusy = stage === 'creating' || stage === 'uploading' || stage === 'starting';

  const hasExistingContent = useMemo(() => {
    const hasOverallFields = Object.values(overallDetails).some((value) =>
      typeof value === 'string' ? value.trim().length > 0 : false,
    );
    return Boolean(cueFile || tracks.length > 0 || audioFile || hasOverallFields || artworkFile);
  }, [audioFile, artworkFile, cueFile, overallDetails, tracks]);

  const requestChangeConfirmation = useCallback(
    (action: () => void) => {
      if (hasExistingContent) {
        confirmActionRef.current = action;
        setConfirmOpen(true);
      } else {
        action();
      }
    },
    [hasExistingContent],
  );

  useEffect(() => {
    const runValidation = () => {
      if (!cueFile && tracks.length === 0) {
        setCueValid(null);
        return;
      }

      try {
        const parsed = {
          fileName: cueFile?.name,
          title: overallDetails.title,
          performer: overallDetails.performer,
          genre: overallDetails.genre,
          releaseYear: overallDetails.releaseYear,
          tracks,
        };
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
  }, [cueFile, tracks, overallDetails]);

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

  const updateOverallDetails = useCallback((patch: Partial<OverallDetails>) => {
    setOverallDetails((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleArtworkDrop = useCallback((files: File[]) => {
    const next = files[0];
    if (!next) return;
    setArtworkFile(next);
    setArtworkProgress(null);
  }, []);

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

  const handleCueDrop = useCallback(
    (files: File[]) => {
      const next = files[0];
      if (!next) return;

      const execute = async () => {
        resetCueContent();
        setCueFile(next);
        try {
          const text = await next.text();
          const parsed = parseCue(text);
          setTracks(parsed.tracks);
          setOverallDetails({
            title: parsed.title ?? '',
            performer: parsed.performer ?? '',
            genre: parsed.genre ?? '',
            releaseYear: parsed.releaseYear ?? '',
          });
          setError(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to parse CUE file';
          setError(message);
          setTracks([]);
        }
      };

      requestChangeConfirmation(() => {
        void execute();
      });
    },
    [requestChangeConfirmation, resetCueContent],
  );

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

  const addTrack = useCallback((startMs: number | null) => {
    const nextNumber =
      sortedTracks.length > 0
        ? Math.max(...sortedTracks.map((t) => t.trackNumber)) + 1
        : 1;
    const lastStart = sortedTracks[sortedTracks.length - 1]?.startMs ?? 0;
    const nextStart = startMs ?? lastStart + 60_000;
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

  const handleSourceSelect = useCallback(
    (type: SourceType) => {
      if (type === sourceType) return;
      requestChangeConfirmation(() => {
        resetCueContent();
        setSourceType(type);
        setError(null);
        setAudioFile(null);
        setSourceUrl('');
        setPlayerUrl(undefined);
        setCurrentMs(0);
        setDurationMs(0);
      });
    },
    [requestChangeConfirmation, resetCueContent, sourceType],
  );

  const handleLocalAudioDrop = useCallback(
    (files: File[]) => {
      const next = files[0];
      if (!next) return;

      requestChangeConfirmation(() => {
        resetCueContent();
        setSourceType('local');
        setAudioFile(next);
        setSourceUrl('');
      });
    },
    [requestChangeConfirmation, resetCueContent],
  );

  const handleSourceUrlChange = useCallback(
    (value: string) => {
      if (value === sourceUrl) return;
      requestChangeConfirmation(() => {
        resetCueContent();
        setSourceUrl(value);
      });
    },
    [requestChangeConfirmation, resetCueContent, sourceUrl],
  );

  const handleConfirmReplace = useCallback(() => {
    const action = confirmActionRef.current;
    confirmActionRef.current = null;
    setConfirmOpen(false);
    action?.();
  }, []);

  const handleCancelReplace = useCallback(() => {
    confirmActionRef.current = null;
    setConfirmOpen(false);
  }, []);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            confirmActionRef.current = null;
          }
          setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current source?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the source will clear the uploaded cue sheet, track list, and overall details. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplace}>Keep current content</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-800 font-semibold text-white" onClick={handleConfirmReplace}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SelectSource sourceType={sourceType} isBusy={isBusy} onSelect={handleSourceSelect} />

      <TracklistEditor
        sourceType={sourceType}
        sourceUrl={sourceUrl}
        onSourceUrlChange={handleSourceUrlChange}
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
        overallDetails={overallDetails}
        onUpdateOverall={updateOverallDetails}
        artworkFile={artworkFile}
        artworkProgress={artworkProgress}
        onArtworkDrop={handleArtworkDrop}
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
