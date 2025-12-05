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
import { EllipsisVertical, FilePenLine, Plus, Upload } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { DropEvent, FileRejection } from 'react-dropzone';
import ReactPlayer from 'react-player';
import type { SourceType } from './select-source';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

export type CueTrackEntry = {
    trackNumber: number;
    title: string;
    performer?: string;
    startMs: number;
};

export type OverallDetails = {
    title: string;
    performer: string;
    genre: string;
    releaseYear: string;
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
    onAddTrack: (startMs: number | null) => void;
    overallDetails: OverallDetails;
    onUpdateOverall: (patch: Partial<OverallDetails>) => void;
    artworkFile: File | null;
    artworkProgress: number | null;
    onArtworkDrop: (files: File[]) => void;
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
    overallDetails,
    onUpdateOverall,
    artworkFile,
    artworkProgress,
    onArtworkDrop,
}: TracklistEditorProps) {
    const sortedTracks = useMemo(
        () => [...tracks].sort((a, b) => a.trackNumber - b.trackNumber),
        [tracks],
    );

    const [cueDialogOpen, setCueDialogOpen] = useState<boolean>(false);
    const playerRef = useRef<HTMLVideoElement | null>(null);

    const seekToMs = (ms: number) => {
        const player = playerRef.current;
        if (!player) return;
        player.currentTime = ms / 1000;
    };

    const setPlayerRef = useCallback((player: HTMLVideoElement | null) => {
        playerRef.current = player;
    }, []);

    const handleDurationChange = () => {
        const player = playerRef.current;
        if (!player) return;
        onPlayerDuration(player.duration * 1000);
    };

    const handleTimeUpdate = () => {
        const player = playerRef.current;
        if (!player || player.seeking) return;
        onPlayerProgress(player.currentTime * 1000);
    };

    const getPlayerCurrentTime = () => {
        const player = playerRef.current;
        if (!player) return null;
        return player.currentTime * 1000;
    };

    const handleOverallChange = (field: keyof OverallDetails, value: string) => {
        onUpdateOverall({ [field]: value });
    };

    const handleCueDropInternal = (
        acceptedFiles: File[],
        _fileRejections: FileRejection[],
        _event: DropEvent
    ) => {
        if (acceptedFiles.length > 0) {
            onCueDrop(acceptedFiles);
            setCueDialogOpen(false);
        }
    };

    return (
        <Card>
            <div className="grid grid-cols-[1fr_auto] gap-3 justify-between">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <FilePenLine /> Tracklist Editor
                    </CardTitle>
                    <CardDescription>
                        Preview your source on the left and edit your CUE sheet on the right. Drop a .cue to prefill.
                    </CardDescription>
                </CardHeader>

                <Dialog open={cueDialogOpen} onOpenChange={setCueDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-fit mr-6">
                            <Upload /> Upload CUE
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload a CUE sheet</DialogTitle>
                        </DialogHeader>
                        <Dropzone
                            accept={{ 'text/cue': ['.cue'] }}
                            disabled={isBusy}
                            maxFiles={1}
                            onDrop={handleCueDropInternal}
                            progress={cueProgress}
                            src={cueFile ? [cueFile] : undefined}
                        >
                            <DropzoneEmptyState />
                            <DropzoneContent />
                        </Dropzone>
                    </DialogContent>
                </Dialog>
            </div>
            <CardContent className="grid gap-6 md:grid-cols-2 max-h-[75vh]">
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
                            accept={{ 'audio/m4a': ['.m4a'] }}
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
                            ref={setPlayerRef}
                            src={playerUrl}
                            controls
                            width="100%"
                            height="240px"
                            onDurationChange={handleDurationChange}
                            onTimeUpdate={handleTimeUpdate}
                        />
                        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
                            <span>Now playing</span>
                            <span>
                                {formatTime(currentMs)} / {formatTime(durationMs)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 overflow-y-scroll">
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full"
                        defaultValue="item-1"
                    >
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="hover:no-underline!">
                                <div>
                                    <p className="text-muted-foreground font-medium text-lg">Overall Details</p>
                                    <p className="text-xs text-muted-foreground">
                                        Provide general information about this mix or set. These map to the disc-level tags in a traditional CUE sheet.
                                    </p>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Card>
                                    <CardContent className="flex flex-col gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="overall-title">Title</Label>
                                            <Input
                                                id="overall-title"
                                                value={overallDetails.title}
                                                onChange={(e) => handleOverallChange('title', e.target.value)}
                                                placeholder="Mix / album title"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="overall-performer">Performer</Label>
                                            <Input
                                                id="overall-performer"
                                                value={overallDetails.performer}
                                                onChange={(e) => handleOverallChange('performer', e.target.value)}
                                                placeholder="Artist or DJ"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="overall-genre">Genre</Label>
                                            <Input
                                                id="overall-genre"
                                                value={overallDetails.genre}
                                                onChange={(e) => handleOverallChange('genre', e.target.value)}
                                                placeholder="Genre"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="overall-release-year">Release Year</Label>
                                            <Input
                                                id="overall-release-year"
                                                value={overallDetails.releaseYear}
                                                onChange={(e) => handleOverallChange('releaseYear', e.target.value)}
                                                placeholder="2024"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Artwork</Label>
                                            <Dropzone
                                                accept={{ 'image/png': ['.png'], 'image/jpg': ['.jpg', '.jpeg'] }}
                                                disabled={isBusy}
                                                maxFiles={1}
                                                onDrop={onArtworkDrop}
                                                progress={artworkProgress}
                                                src={artworkFile ? [artworkFile] : undefined}
                                            >
                                                <DropzoneEmptyState />
                                                <DropzoneContent />
                                            </Dropzone>
                                            {artworkFile ? (
                                                <p className="text-xs text-muted-foreground">Selected: {artworkFile.name}</p>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">PNG or JPG up to 10MB.</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    <div className="flex flex-row gap-1.5">
                        <span className="text-muted-foreground font-medium text-lg">Tracks</span>
                        <Badge className="my-auto" variant="secondary">{sortedTracks.length}</Badge>
                    </div>
                    <div className="flex flex-col gap-3">
                        {sortedTracks.map((track, idx) => {
                            const nextStart = sortedTracks[idx + 1]?.startMs;
                            const isActive = activeTrack?.trackNumber === track.trackNumber;
                            const progress = trackProgressPercent(track.startMs, nextStart);
                            const handleCardActivate = () => seekToMs(track.startMs);

                            return (
                                <Card
                                    key={`${track.trackNumber}-${idx}`}
                                    className={isActive ? 'border-primary/60 bg-accent' : undefined}
                                    onClick={(event) => {
                                        const target = event.target as HTMLElement;
                                        if (target.closest('input,button')) return;
                                        handleCardActivate();
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleCardActivate();
                                        }
                                    }}
                                    tabIndex={0}
                                >
                                    <CardHeader className="pb-3">

                                        <div className="flex items-start justify-between gap-6">
                                            <div className="flex flex-col gap-2 w-full">
                                                <p className="text-muted-foreground py-1.5">
                                                    Track {idx + 1}
                                                </p>
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
                        <Button type="button" variant="outline" onClick={() => onAddTrack(getPlayerCurrentTime())} className="w-full" disabled={isBusy}>
                            <Plus className="mr-2 size-4" /> Add Track
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
