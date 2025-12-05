import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  Scissors,
  Upload,
  Loader2,
} from 'lucide-react';
import type { SourceType } from './select-source';

type ConfirmUploadProps = {
  sourceType: SourceType;
  jobId: string | null;
  cueValid: boolean | null;
  isBusy: boolean;
  actionDisabled: boolean;
  actionLabel: string;
  onAction: () => void;
};

export function ConfirmUpload({
  sourceType,
  jobId,
  cueValid,
  isBusy,
  actionDisabled,
  actionLabel,
  onAction,
}: ConfirmUploadProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-2xl font-semibold">
        <Scissors className="size-5" /> Confirm Upload
      </div>
      <p className="text-sm text-muted-foreground">
        Upload your audio and CUE (local files supported today; remote downloads will be wired next).
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div>
            Source: {sourceType === 'local' ? 'Local file' : sourceType === 'youtube' ? 'YouTube' : 'SoundCloud'}
            {sourceType !== 'local' && ' (download pipeline pending)'}
          </div>
          <div>
            {jobId
              ? `Ready to start job ${jobId}`
              : 'Uploads will be named source.m4a/source.cue under the job prefix.'}
          </div>
        </div>
        {cueValid === true ? (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-700 text-sm">
            <CheckCircle2 className="size-4" />
            CUE sheet valid
          </div>
        ) : cueValid === false ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
            <AlertTriangle className="size-4" />
            CUE sheet invalid
          </div>
        ) : null}
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
