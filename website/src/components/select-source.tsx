import { Button } from '@/components/ui/button';
import { Cloud, FileAudio, Upload, Youtube } from 'lucide-react';

export type SourceType = 'youtube' | 'soundcloud' | 'local';

type SelectSourceProps = {
  sourceType: SourceType;
  isBusy: boolean;
  onSelect: (type: SourceType) => void;
};

export function SelectSource({ sourceType, isBusy, onSelect }: SelectSourceProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-2xl font-semibold">
        <Upload className="size-5" /> Source Selector
      </div>
      <p className="text-sm text-muted-foreground">
        Choose your source: YouTube, SoundCloud, or a local file.
      </p>
      <div className="flex flex-wrap gap-3">
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
      </div>
    </div>
  );
}
