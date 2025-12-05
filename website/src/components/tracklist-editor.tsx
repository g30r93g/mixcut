import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
    Dropzone,
    DropzoneContent,
    DropzoneEmptyState
} from '@/components/ui/shadcn-io/dropzone';
import { EllipsisVertical, Plus } from 'lucide-react';
import { useMemo } from 'react';
import ReactPlayer from 'react-player';
import type { SourceType } from './select-source';

export type CueTrackEntry = {
  trackNumber: number;
  title: string;
  performer?: string;
  startMs: number;
};

type TracklistEditorProps = {
  sourceType: SourceType;
  sourceUrl: string;
  onSourceUrlChange: (value: string) => void;
  playerUrl: string | undefined;
  isBusy: boolean;
  audioFile: File | null;
  audioProgress: number | null;
  onLocalAudioDrop: (files: File[]) => void;
  onPlayerDuration: (ms: number) => void;
  onPlayerProgress: (ms: number) => void;
  currentMs: number;
  durationMs: number;
  formatTime: (ms: number) => string;
  cueFile: File | null;
  cueProgress: number | null;
  onCueDrop: (files: File[]) => void;
  tracks: CueTrackEntry[];
  activeTrack: CueTrackEntry | null;
  trackProgressPercent: (startMs: number, nextStartMs?: number) => number;
  onUpdateTrack: (index: number, patch: Partial<CueTrackEntry>) => void;
  onRemoveTrack: (index: number) => void;
  onAddTrack: () => void;
};

export function TracklistEditor({
  sourceType,
  sourceUrl,
  onSourceUrlChange,
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
  onUpdateTrack,
  onRemoveTrack,
  onAddTrack,
}: TracklistEditorProps) {
  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.trackNumber - b.trackNumber),
    [tracks],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          Tracklist Editor
        </CardTitle>
        <CardDescription>
          Preview your source on the left and edit your CUE sheet on the right. Drop a .cue to prefill.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {sourceType !== 'local' && (
            <div className="space-y-2">
              <Label htmlFor="sourceUrl">Source URL</Label>
              <Input
                id="sourceUrl"
                placeholder={sourceType === 'youtube' ? 'https://youtu.be/...' : 'https://soundcloud.com/...'}
                value={sourceUrl}
                onChange={(e) => onSourceUrlChange(e.target.value)}
              />
            </div>
          )}

          {sourceType === 'local' && (
            <Dropzone
              accept={{ 'audio/*': ['.m4a'] }}
              disabled={isBusy}
              maxFiles={1}
              onDrop={onLocalAudioDrop}
              progress={audioProgress}
              src={audioFile ? [audioFile] : undefined}
            >
              <DropzoneEmptyState />
              <DropzoneContent />
            </Dropzone>
          )}

          <div className="overflow-hidden rounded-md border bg-muted">
            <ReactPlayer
              src={playerUrl}
              controls
              width="100%"
              height="240px"
              onDurationChange={(event) => {
                  const player = event.currentTarget;
                  console.log('onDurationChange', event)
                  if (!player) return;

                  onPlayerDuration(player.duration * 1000)
                }}
                onTimeUpdate={(event) => {
                  const player = event.currentTarget;
                  console.log('onTimeUpdate', event)
                  if (!player || player.seeking) return;

                  if (!player.duration) return;

                  onPlayerProgress(player.currentTime * 1000)
                }}
            />
            <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
              <span>Now playing</span>
              <span>
                {formatTime(currentMs)} / {formatTime(durationMs)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Dropzone
            accept={{ 'text/cue': ['.cue'] }}
            disabled={isBusy}
            maxFiles={1}
            onDrop={onCueDrop}
            progress={cueProgress}
            src={cueFile ? [cueFile] : undefined}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          <div className="flex flex-col gap-3">
            {sortedTracks.map((track, idx) => {
              const nextStart = sortedTracks[idx + 1]?.startMs;
              const isActive = activeTrack?.trackNumber === track.trackNumber;
              const progress = trackProgressPercent(track.startMs, nextStart);
              return (
                <Card key={`${track.trackNumber}-${idx}`} className={isActive ? 'border-primary/60' : undefined}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-2">
                        <Input
                          value={track.title}
                          onChange={(e) => onUpdateTrack(idx, { title: e.target.value })}
                          placeholder="Track title"
                        />
                        <Input
                          value={track.performer ?? ''}
                          onChange={(e) => onUpdateTrack(idx, { performer: e.target.value })}
                          placeholder="Artist"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatTime(track.startMs)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <EllipsisVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="backdrop-blur">
                            <DropdownMenuItem onClick={() => onRemoveTrack(idx)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Label htmlFor={`track-start-${track.trackNumber}`}>Start time (ms)</Label>
                    <Input
                      id={`track-start-${track.trackNumber}`}
                      type="number"
                      value={track.startMs}
                      onChange={(e) =>
                        onUpdateTrack(idx, { startMs: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                    <Progress value={progress} className="h-2" />
                  </CardContent>
                </Card>
              );
            })}
            <Button type="button" variant="outline" onClick={onAddTrack} className="w-full" disabled={isBusy}>
              <Plus className="mr-2 size-4" /> Add Track
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
