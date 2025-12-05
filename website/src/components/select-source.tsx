import { Button } from '@/components/ui/button';
import { Cloud, FileAudio, Upload, Youtube } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export type SourceType = 'youtube' | 'soundcloud' | 'local';

type SelectSourceProps = {
    sourceType: SourceType;
    isBusy: boolean;
    onSelect: (type: SourceType) => void;
};

export function SelectSource({ sourceType, isBusy, onSelect }: SelectSourceProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                    <Upload className="size-5" /> Source Selector
                </CardTitle>
                <CardDescription>
                    Choose your source: YouTube, SoundCloud, or a local file.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-row gap-3">
                <Button
                    type="button"
                    variant={sourceType === 'youtube' ? 'default' : 'outline'}
                    onClick={() => onSelect('youtube')}
                    disabled={isBusy}
                    className="flex items-center gap-2"
                >
                    <Youtube className="size-4" />
                    YouTube
                </Button>
                <Button
                    type="button"
                    variant={sourceType === 'soundcloud' ? 'default' : 'outline'}
                    onClick={() => onSelect('soundcloud')}
                    disabled={isBusy}
                    className="flex items-center gap-2"
                >
                    <Cloud className="size-4" />
                    SoundCloud
                </Button>
                <Button
                    type="button"
                    variant={sourceType === 'local' ? 'default' : 'outline'}
                    onClick={() => onSelect('local')}
                    disabled={isBusy}
                    className="flex items-center gap-2"
                >
                    <FileAudio className="size-4" />
                    Local File
                </Button>
            </CardContent>
        </Card>
    );
}
