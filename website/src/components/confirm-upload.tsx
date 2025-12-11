import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Stage } from '@/types/jobs';
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
  stage: Stage;
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
  stage,
}: ConfirmUploadProps) {
  const progressItems = [
    { label: 'Track', value: audioProgress },
    { label: 'Artwork', value: artworkProgress },
    { label: 'CUE Sheet', value: cueProgress },
  ];

  const canTriggerAction = stage !== 'started';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Scissors className="size-5" /> Upload &amp; Cut
        </CardTitle>
        <CardDescription>Upload your prepared files and kick off the cutting job.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3">
          {progressItems.map(({ label, value }) => {
            const hasProgress = typeof value === 'number';
            const displayValue = hasProgress ? Math.round(value) : 0;
            const statusText = hasProgress ? `${displayValue}%` : 'Waiting';

            return (
              <div key={label} className="space-y-1.5">
                <div className="text-muted-foreground flex items-center justify-between text-xs uppercase tracking-wide">
                  <span>{label}</span>
                  <span>{statusText}</span>
                </div>
                <Progress value={displayValue} className="h-2" />
              </div>
            );
          })}
        </div>

        <div className="bg-muted/40 text-muted-foreground flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <div className="flex flex-col">
            <span>
              {jobId
                ? stage === 'started'
                  ? `Job ${jobId} is processing. Monitor progress below.`
                  : `Ready to start job ${jobId}`
                : 'Uploads will be named source.m4a/source.cue under the job prefix.'}
            </span>
          </div>
          {canTriggerAction ? (
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
          ) : (
            <span className="text-primary text-xs font-medium uppercase tracking-wide">In progress</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoaderIcon() {
  return <Loader2 className="size-4 animate-spin" />;
}
