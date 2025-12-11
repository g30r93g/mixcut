'use client';

import { Button } from '@/components/ui/button';
import { TrackWaveform, type TrackWaveformHandle, type TrackWaveformProps } from '@/components/track-waveform';
import { TracklistEditor, type TracklistEditorProps } from '@/components/tracklist-editor';
import type { Ref } from 'react';

export type TrackWorkspaceProps = TrackWaveformProps &
  TracklistEditorProps & {
    waveformRef?: Ref<TrackWaveformHandle | null>;
    onContinue?: () => void;
    continueLabel?: string;
  };

export function TrackWorkspace({
  waveformRef,
  playerUrl,
  isBusy,
  audioFile,
  audioProgress,
  onLocalAudioDrop,
  onPlayerDuration,
  onPlayerProgress,
  currentMs,
  durationMs,
  formatTime,
  cueFile,
  cueProgress,
  onCueDrop,
  tracks,
  activeTrack,
  trackProgressPercent,
  onRequestSeek,
  onUpdateTrack,
  onRemoveTrack,
  onAddTrack,
  overallDetails,
  onUpdateOverall,
  artworkFile,
  artworkProgress,
  onArtworkDrop,
  onContinue,
  continueLabel = 'Continue',
}: TrackWorkspaceProps) {
  const hasCue = Boolean(cueFile) || tracks.length > 0;
  const hasTrack = Boolean(audioFile);
  const canContinue = hasCue && hasTrack && !isBusy;

  return (
    <div className="flex flex-col gap-6">
      <TrackWaveform
        ref={waveformRef}
        playerUrl={playerUrl}
        isBusy={isBusy}
        audioFile={audioFile}
        audioProgress={audioProgress}
        onLocalAudioDrop={onLocalAudioDrop}
        onPlayerDuration={onPlayerDuration}
        onPlayerProgress={onPlayerProgress}
        currentMs={currentMs}
        durationMs={durationMs}
        formatTime={formatTime}
      />

      <TracklistEditor
        isBusy={isBusy}
        currentMs={currentMs}
        formatTime={formatTime}
        cueFile={cueFile}
        cueProgress={cueProgress}
        onCueDrop={onCueDrop}
        tracks={tracks}
        activeTrack={activeTrack}
        trackProgressPercent={trackProgressPercent}
        onRequestSeek={onRequestSeek}
        onUpdateTrack={onUpdateTrack}
        onRemoveTrack={onRemoveTrack}
        onAddTrack={onAddTrack}
        overallDetails={overallDetails}
        onUpdateOverall={onUpdateOverall}
        artworkFile={artworkFile}
        artworkProgress={artworkProgress}
        onArtworkDrop={onArtworkDrop}
      />

      <div className="flex justify-end">
        <Button type="button" size="lg" disabled={!canContinue} onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
