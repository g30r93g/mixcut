'use client';

import { ConfirmUpload } from '@/components/confirm-upload';
import { TracklistEditor, type CueTrackEntry, type OverallDetails } from '@/components/tracklist-editor';
import { ReplaceContentDialog } from '@/components/replace-content-dialog';
import { buildCueFile, emptyOverallDetails } from '@/lib/cue-helpers';
import { formatTimeLabel } from '@/lib/time';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { parseCue } from '@mixcut/parser';
import { useCueValidation } from './hooks/useCueValidation';
import { useObjectUrl } from './hooks/useObjectUrl';
import { useUploadWorkflow } from './hooks/useUploadWorkflow';

export default function UploadPage() {
  const router = useRouter();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [cueFile, setCueFile] = useState<File | null>(null);
  const [tracks, setTracks] = useState<CueTrackEntry[]>([]);
  const [currentMs, setCurrentMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [overallDetails, setOverallDetails] = useState<OverallDetails>(emptyOverallDetails);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmActionRef = useRef<(() => void) | null>(null);

  const playerUrl = useObjectUrl(audioFile);
  const { cueValid, resetCueValidation } = useCueValidation({
    cueFile,
    tracks,
    overallDetails,
    onError: setError,
  });

  const generateCueFromTracks = useCallback(() => {
    const file = buildCueFile({
      entries: tracks,
      overallDetails,
      audioFileName: audioFile?.name,
    });
    if (file) {
      setCueFile(file);
    }
    return file;
  }, [audioFile, overallDetails, tracks]);

  const {
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
  } = useUploadWorkflow({
    audioFile,
    cueFile,
    artworkFile,
    cueValid,
    generateCueFile: generateCueFromTracks,
    setError,
    router,
  });

  const resetCueContent = useCallback(() => {
    setCueFile(null);
    setTracks([]);
    resetCueValidation();
    setOverallDetails({ ...emptyOverallDetails });
    setArtworkFile(null);
    setArtworkProgress(null);
  }, [resetCueValidation, setArtworkProgress]);

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

  const updateOverallDetails = useCallback((patch: Partial<OverallDetails>) => {
    setOverallDetails((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleArtworkDrop = useCallback(
    (files: File[]) => {
      const next = files[0];
      if (!next) return;
      setArtworkFile(next);
      setArtworkProgress(null);
    },
    [setArtworkProgress],
  );

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
      <ReplaceContentDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            confirmActionRef.current = null;
          }
          setConfirmOpen(open);
        }}
        onCancel={handleCancelReplace}
        onConfirm={handleConfirmReplace}
      />

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
        formatTime={formatTimeLabel}
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
