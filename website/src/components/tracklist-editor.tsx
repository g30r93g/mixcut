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
import { EllipsisVertical, FilePenLine, Plus, Upload } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from './ui/shadcn-io/dropzone';

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

export type TracklistEditorProps = {
    isBusy: boolean;
    currentMs: number;
    formatTime: (ms: number) => string;
    cueFile: File | null;
    onCueDrop: (files: File[]) => void;
    tracks: CueTrackEntry[];
    activeTrack: CueTrackEntry | null;
    trackProgressPercent: (startMs: number, nextStartMs?: number) => number;
    onRequestSeek: (ms: number) => void;
    onUpdateTrack: (index: number, patch: Partial<CueTrackEntry>) => void;
    onRemoveTrack: (index: number) => void;
    onAddTrack: (startMs: number | null) => void;
    overallDetails: OverallDetails;
    onUpdateOverall: (patch: Partial<OverallDetails>) => void;
    artworkFile: File | null;
    onArtworkDrop: (files: File[]) => void;
};

export function TracklistEditor({
    isBusy,
    currentMs,
    formatTime,
    cueFile,
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
    onArtworkDrop,
}: TracklistEditorProps) {
    const sortedTracks = useMemo(
        () => [...tracks].sort((a, b) => a.trackNumber - b.trackNumber),
        [tracks],
    );

    const [cueDialogOpen, setCueDialogOpen] = useState<boolean>(false);
    const handleOverallChange = (field: keyof OverallDetails, value: string) => {
        onUpdateOverall({ [field]: value });
    };

    const handleCueDropInternal = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) {
            return;
        }
        onCueDrop(acceptedFiles);
        setCueDialogOpen(false);
    }, [onCueDrop]);

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
                            src={cueFile ? [cueFile] : undefined}
                        >
                            <DropzoneEmptyState />
                            <DropzoneContent />
                        </Dropzone>
                    </DialogContent>
                </Dialog>
            </div>
            <CardContent className="grid grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Details</CardTitle>
                        <CardDescription>
                            Provide general information about this mix or set. These map to the disc-level tags in a traditional CUE sheet.
                        </CardDescription>
                    </CardHeader>
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
                <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-scroll">
                    <div className="flex flex-row gap-1.5">
                        <span className="text-muted-foreground font-medium text-lg">Tracks</span>
                        <Badge className="my-auto" variant="secondary">{sortedTracks.length}</Badge>
                    </div>
                    <div className="flex flex-col gap-3 pb-4">
                        {sortedTracks.map((track, idx) => {
                            const nextTrack = sortedTracks[idx + 1];
                            const nextStart = nextTrack?.startMs;
                            const isActive = activeTrack?.trackNumber === track.trackNumber;
                            const progress = trackProgressPercent(track.startMs, nextStart);
                            const handleCardActivate = () => onRequestSeek(track.startMs);

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
                        <Button type="button" variant="outline" onClick={() => onAddTrack(currentMs)} className="w-full" disabled={isBusy}>
                            <Plus className="mr-2 size-4" /> Add Track
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
