'use client';

import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';

import { AudioLines, Pause, Play, Upload } from 'lucide-react';
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type ChangeEvent
} from 'react';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from './ui/shadcn-io/dropzone';

export type TrackWaveformHandle = {
    seekTo: (ms: number) => void;
};

export type TrackWaveformProps = {
    playerUrl: string | undefined;
    isBusy: boolean;
    audioFile: File | null;
    onLocalAudioDrop: (files: File[]) => void;
    onPlayerDuration: (ms: number) => void;
    onPlayerProgress: (ms: number) => void;
    currentMs: number;
    durationMs: number;
    formatTime: (ms: number) => string;
};

export const TrackWaveform = forwardRef<TrackWaveformHandle, TrackWaveformProps>(
    (
        {
            playerUrl,
            isBusy,
            audioFile,
            onLocalAudioDrop,
            onPlayerDuration,
            onPlayerProgress,
            currentMs,
            durationMs,
            formatTime,
        },
        ref,
    ) => {
        const [trackUploadDialogOpen, setTrackUploadDialogOpen] = useState<boolean>(false);
        const containerRef = useRef<HTMLDivElement | null>(null);
        const wavesurferRef = useRef<WaveSurfer | null>(null);
        const [isReady, setIsReady] = useState(false);
        const [isPlaying, setIsPlaying] = useState(false);
        const [minPxPerSec, setMinPxPerSec] = useState(120);
        const minPxPerSecRef = useRef(minPxPerSec);
        const hasAudio = Boolean(playerUrl);

        useImperativeHandle(
            ref,
            () => ({
                seekTo: (ms: number) => {
                    const instance = wavesurferRef.current;
                    if (!instance || !isReady) return;
                    const durationSeconds = instance.getDuration();
                    if (durationSeconds <= 0) return;
                    const nextSeconds = Math.max(
                        0,
                        Math.min(ms / 1000, durationSeconds),
                    );
                    instance.setTime(nextSeconds);
                    onPlayerProgress(nextSeconds * 1000);
                },
            }),
            [isReady, onPlayerProgress],
        );

        useEffect(() => {
            const container = containerRef.current;
            if (!container) return;
            const instance = WaveSurfer.create({
                container,
                height: 160,
                waveColor: 'rgba(148, 163, 184, 0.5)',
                progressColor: '#4f46e5',
                cursorColor: '#4f46e5',
                cursorWidth: 2,
                normalize: true,
                barWidth: 2,
                minPxPerSec: minPxPerSecRef.current,
                barGap: 1,
                barRadius: 1,
                plugins: [
                    TimelinePlugin.create()
                ]
            });

            wavesurferRef.current = instance;

            instance.on('ready', () => {
                setIsReady(true);
                onPlayerDuration(instance.getDuration() * 1000);
            });

            const updateProgress = (time: number) => {
                // console.log('updateProgress', `${time * 1000} ms`);
                onPlayerProgress(time * 1000);
            };

            instance.on('timeupdate', updateProgress);
            instance.on('audioprocess', updateProgress);
            instance.on('seeking', updateProgress);
            instance.on('interaction', updateProgress);

            instance.on('play', () => setIsPlaying(true));
            instance.on('pause', () => setIsPlaying(false));
            instance.on('finish', () => setIsPlaying(false));

            return () => {
                instance.destroy();
                wavesurferRef.current = null;
            };
        }, [onPlayerDuration, onPlayerProgress]);

        useEffect(() => {
            const instance = wavesurferRef.current;
            if (!instance) return;

            const resetStateTimeout = window.setTimeout(() => {
                setIsReady(false);
                setIsPlaying(false);
            }, 0);

            if (!playerUrl) {
                instance.empty();
                return () => {
                    window.clearTimeout(resetStateTimeout);
                };
            }

            instance.load(playerUrl);

            return () => {
                window.clearTimeout(resetStateTimeout);
            };
        }, [playerUrl]);

        useEffect(() => {
            const instance = wavesurferRef.current;
            if (!instance || !isReady) return;

            const currentSeconds = currentMs / 1000;
            const delta = Math.abs(instance.getCurrentTime() - currentSeconds);
            if (!instance.isPlaying() && delta > 0.2) {
                instance.setTime(currentSeconds);
            }
        }, [currentMs, isReady]);

        const togglePlayback = useCallback(() => {
            const instance = wavesurferRef.current;
            if (!instance || !isReady) return;
            if (instance.isPlaying()) {
                instance.pause();
            } else {
                void instance.play();
            }
        }, [isReady]);

        useEffect(() => {
            minPxPerSecRef.current = minPxPerSec;
            const instance = wavesurferRef.current;
            if (!instance || !hasAudio || !isReady) return;
            instance.zoom(minPxPerSec);
        }, [minPxPerSec, hasAudio, isReady]);

        const handleZoomChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
            setMinPxPerSec(Number(event.target.value));
        }, []);

        return (
            <Card>
                <div className="grid grid-cols-[1fr_auto] gap-3 justify-between">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <AudioLines /> Track
                        </CardTitle>
                        <CardDescription>
                            Upload your source file and preview its waveform.
                        </CardDescription>
                    </CardHeader>

                    <Dialog open={trackUploadDialogOpen} onOpenChange={setTrackUploadDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-fit mr-6">
                                <Upload /> Change Track
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Change Track</DialogTitle>
                            </DialogHeader>
                            <Dropzone
                                accept={{ 'audio/m4a': ['.m4a'] }}
                                disabled={isBusy}
                                maxFiles={1}
                                onDrop={onLocalAudioDrop}
                                src={audioFile ? [audioFile] : undefined}
                            >
                                <DropzoneEmptyState />
                                <DropzoneContent />
                            </Dropzone>
                        </DialogContent>
                    </Dialog>
                </div>
                <CardContent className="flex flex-col gap-4">
                    <div className="rounded-md border bg-muted/40 p-4 relative">
                        <div className="relative mb-12">
                            <div
                                ref={containerRef}
                                className={`relative h-40 w-full ${hasAudio ? '' : 'opacity-40'} no-scrollbar`}
                            />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                                <div>
                                    Now playing{' '}
                                    <span className="font-mono text-primary">
                                        {formatTime(currentMs)}
                                    </span>{' '}
                                    / {formatTime(durationMs)}
                                </div>
                                <label className="flex flex-col gap-2">
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                                        Zoom ({Math.round(minPxPerSec)}px/s)
                                    </span>
                                    <input
                                        type="range"
                                        min={40}
                                        max={400}
                                        step={10}
                                        value={minPxPerSec}
                                        onChange={handleZoomChange}
                                        disabled={!hasAudio}
                                        className="h-2 w-48 cursor-pointer accent-primary"
                                    />
                                </label>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={togglePlayback}
                                disabled={!hasAudio || !isReady}
                            >
                                {isPlaying ? (
                                    <>
                                        <Pause className="mr-2 size-4" />
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 size-4" />
                                        Play
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    },
);

TrackWaveform.displayName = 'TrackWaveform';
