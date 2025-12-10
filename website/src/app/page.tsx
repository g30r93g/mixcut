'use client';

import { ConfirmUpload } from '@/components/confirm-upload';
import { TracklistEditor, type CueTrackEntry, type OverallDetails } from '@/components/tracklist-editor';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { retryWithBackoff } from '@/lib/retry-utils';
import { uploadToPresigned } from '@/lib/upload-utils';
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

export default function UploadPage() {
  const router = useRouter();
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
    setPlayerUrl('');
    return undefined;
  }, [audioFile]);

  const updateOverallDetails = useCallback((patch: Partial<OverallDetails>) => {
    setOverallDetails((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleArtworkDrop = useCallback((files: File[]) => {
    const next = files[0];
    if (!next) return;
    setArtworkFile(next);
    setArtworkProgress(null);
  }, []);

  const generateCueFile = useCallback(
    (entries: CueTrackEntry[]) => {
      if (!entries.length) {
        return null;
      }

      const escapeCueValue = (value: string) => value.replace(/"/g, '\\"');
      const formatIndex = (ms: number) => {
        const framesPerSecond = 75;
        const totalFrames = Math.max(0, Math.round((ms / 1000) * framesPerSecond));
        const minutes = Math.floor(totalFrames / (framesPerSecond * 60));
        const remainingFrames = totalFrames - minutes * framesPerSecond * 60;
        const seconds = Math.floor(remainingFrames / framesPerSecond);
        const frames = remainingFrames - seconds * framesPerSecond;
        const mm = minutes.toString().padStart(2, '0');
        const ss = seconds.toString().padStart(2, '0');
        const ff = frames.toString().padStart(2, '0');
        return `${mm}:${ss}:${ff}`;
      };

      const lines: string[] = [];
      const { title, performer, genre, releaseYear } = overallDetails;
      const trimmedTitle = title.trim();
      const trimmedPerformer = performer.trim();
      const trimmedGenre = genre.trim();
      const trimmedReleaseYear = releaseYear.trim();

      if (trimmedTitle) {
        lines.push(`TITLE "${escapeCueValue(trimmedTitle)}"`);
      }
      if (trimmedPerformer) {
        lines.push(`PERFORMER "${escapeCueValue(trimmedPerformer)}"`);
      }
      if (trimmedGenre) {
        lines.push(`REM GENRE "${escapeCueValue(trimmedGenre)}"`);
      }
      if (trimmedReleaseYear) {
        lines.push(`REM DATE "${escapeCueValue(trimmedReleaseYear)}"`);
      }

      const fileLabel = audioFile?.name?.trim() || 'source.m4a';
      lines.push(`FILE "${escapeCueValue(fileLabel)}" MP4`);

      const sortedEntries = [...entries].sort((a, b) => a.trackNumber - b.trackNumber);
      for (const track of sortedEntries) {
        const trackTitle = track.title.trim() || `Track ${track.trackNumber}`;
        const trackPerformer = track.performer?.trim();
        const paddedTrackNumber = track.trackNumber.toString().padStart(2, '0');
        lines.push(`  TRACK ${paddedTrackNumber} AUDIO`);
        lines.push(`    TITLE "${escapeCueValue(trackTitle)}"`);
        if (trackPerformer) {
          lines.push(`    PERFORMER "${escapeCueValue(trackPerformer)}"`);
        }
        lines.push(`    INDEX 01 ${formatIndex(track.startMs)}`);
      }

      const cueContents = `${lines.join('\n')}\n`;
      const blob = new Blob([cueContents], { type: 'text/plain' });
      const file = new File([blob], 'source.cue', { type: 'text/plain' });
      setCueFile(file);
      return file;
    },
    [audioFile, overallDetails],
  );

  const handleUpload = useCallback(async () => {
    if (!audioFile) {
      setError('Please select both an audio file and its matching .cue file.');
      return;
    }

    const latestCueFile = generateCueFile(tracks) ?? cueFile;
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

      // Todo: remove duplication but prevent promise.all from executing server was supposed to return an artwork upload URL
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
  }, [audioFile, artworkFile, cueFile, cueValid, generateCueFile, tracks]);

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

    return !audioFile || !cueFile || isBusy;
  }, [audioFile, cueFile, jobId, isBusy, stage]);

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

      void execute();
    },
    [resetCueContent],
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

  const handleLocalAudioDrop = useCallback(
    (files: File[]) => {
      const next = files[0];
      if (!next) return;

      requestChangeConfirmation(() => {
        resetCueContent();
        setAudioFile(next);
        setPlayerUrl(undefined);
        setCurrentMs(0);
        setDurationMs(0);
      });
    },
    [requestChangeConfirmation, resetCueContent],
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
            <AlertDialogTitle>Replace current files?</AlertDialogTitle>
            <AlertDialogDescription>
              Replacing the audio or cue file will clear the uploaded cue sheet, track list, and overall details. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplace}>Keep current content</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-800 font-semibold text-white" onClick={handleConfirmReplace}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TracklistEditor
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
        jobId={jobId}
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
