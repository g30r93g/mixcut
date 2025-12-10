import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Scissors, Upload } from 'lucide-react';

type ConfirmUploadProps = {
  jobId: string | null;
  isBusy: boolean;
  actionDisabled: boolean;
  actionLabel: string;
  onAction: () => void;
  audioProgress: number | null;
  artworkProgress: number | null;
  cueProgress: number | null;
};

export function ConfirmUpload({
  jobId,
  isBusy,
  actionDisabled,
  actionLabel,
  onAction,
  audioProgress,
  artworkProgress,
  cueProgress,
}: ConfirmUploadProps) {
  const progressItems = [
    { label: 'Track', value: audioProgress },
    { label: 'Artwork', value: artworkProgress },
    { label: 'CUE Sheet', value: cueProgress },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-2xl font-semibold">
        <Scissors className="size-5" /> Confirm Upload
      </div>
      <p className="text-sm text-muted-foreground">
        Upload your CUE sheet and matching local audio file.
      </p>

      <div className="grid gap-3">
        {progressItems.map(({ label, value }) => {
          const hasProgress = typeof value === 'number';
          const displayValue = hasProgress ? Math.round(value) : 0;
          const statusText = hasProgress ? `${displayValue}%` : 'Waiting';

          return (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{label}</span>
                <span>{statusText}</span>
              </div>
              <Progress value={displayValue} className="h-2" />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div>Source: Local file upload</div>
          <div>
            {jobId
              ? `Ready to start job ${jobId}`
              : 'Uploads will be named source.m4a/source.cue under the job prefix.'}
          </div>
        </div>
        <Button disabled={actionDisabled} onClick={onAction} size="lg">
          {isBusy ? (
            <LoaderIcon />
          ) : actionLabel === 'Cut' ? (
            <Scissors className="size-4" />
          ) : (
            <Upload className="size-4" />
          )}
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function LoaderIcon() {
  return <Loader2 className="size-4 animate-spin" />;
}
