'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from '@/components/ui/shadcn-io/dropzone';
import { parseCue, validateCue } from '@mixcut/parser';
import type { CreateJobResponse } from '@mixcut/shared';
import { AlertTriangle, CheckCircle2, Loader2, Scissors, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const apiBase = (
  process.env.NEXT_PUBLIC_GATEWAY_URL ??
  'https://nti1l1oe3f.execute-api.eu-west-2.amazonaws.com/prod'
).replace(/\/$/, '');
const apiUrl = (path: string) => `${apiBase}${path}`;

type Stage = 'idle' | 'creating' | 'uploading' | 'uploaded' | 'starting';

async function uploadToPresigned(
  url: string,
  file: File,
  fallbackType: string,
  onProgress?: (percent: number) => void
) {
  const contentType = file.type || fallbackType;

  // XMLHttpRequest for progress support
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onerror = () => reject(new Error('Network error uploading file'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.send(file);
  });
}

export default function UploadPage() {
  const router = useRouter();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [cueFile, setCueFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cueValid, setCueValid] = useState<boolean | null>(null);
  const [audioProgress, setAudioProgress] = useState<number | null>(null);
  const [cueProgress, setCueProgress] = useState<number | null>(null);

  const isBusy = stage === 'creating' || stage === 'uploading' || stage === 'starting';

  useEffect(() => {
    const runValidation = async () => {
      if (!cueFile) {
        setCueValid(null);
        return;
      }

      try {
        const cueText = await cueFile.text();
        const parsed = parseCue(cueText);
        const validation = validateCue(parsed);
        if (!validation.ok) {
          throw new Error(validation.error || 'Invalid CUE sheet');
        }
        setCueValid(true);
        setError(null);
      } catch (err: unknown) {
        setCueValid(false);
        const message = err instanceof Error ? err.message : 'Invalid CUE sheet';
        setError(message);
      }
    };

    void runValidation();
  }, [cueFile]);

  const handleUpload = useCallback(async () => {
    if (!audioFile || !cueFile) {
      setError('Please select both an .m4a file and its matching .cue file.');
      return;
    }

    if (cueValid !== true) {
      setError('Invalid CUE sheet');
      return;
    }

    setError(null);
    setStage('creating');

    try {
      const response = await fetch(apiUrl('/jobs'), {
        method: 'POST',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to create job');
      }

      const payload = (await response.json()) as CreateJobResponse;
      setJobId(payload.jobId);
      setStage('uploading');
      setAudioProgress(0);
      setCueProgress(0);

      await Promise.all([
        uploadToPresigned(payload.uploadUrls.audio, audioFile, 'audio/mp4', setAudioProgress),
        uploadToPresigned(payload.uploadUrls.cue, cueFile, 'text/plain', setCueProgress),
      ]);

      setStage('uploaded');
      setAudioProgress(100);
      setCueProgress(100);
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        setAudioProgress(null);
        setCueProgress(null);
        setStage('idle');
      }
  }, [audioFile, cueFile, cueValid]);

  const handleStart = useCallback(async () => {
    if (!jobId) return;
    setError(null);
    setStage('starting');

    try {
      const response = await fetch(apiUrl(`/jobs/${jobId}/start`), {
        method: 'POST',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to start processing');
      }

      router.push(`/job/${jobId}`);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to start processing';
      setError(message);
      setStage('uploaded');
    }
  }, [jobId, router]);

  const actionLabel = useMemo(() => {
    if (stage === 'uploaded') return 'Cut';
    if (stage === 'creating') return 'Creating job…';
    if (stage === 'uploading') return 'Uploading…';
    if (stage === 'starting') return 'Starting…';
    return 'Upload';
  }, [stage]);

  const actionDisabled = useMemo(() => {
    if (stage === 'uploaded') {
      return !jobId || isBusy;
    }

    return !audioFile || !cueFile || isBusy;
  }, [audioFile, cueFile, jobId, isBusy, stage]);

  const onAction = stage === 'uploaded' ? handleStart : handleUpload;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Upload className="size-5" /> Upload & Split
          </CardTitle>
          <CardDescription>
            Drop in your source .m4a and matching .cue sheet. We will request
            presigned uploads, send them to S3, then kick off the splitter.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Dropzone
            accept={{ 'audio/mp4': ['.m4a'] }}
            disabled={isBusy}
            maxFiles={1}
            onDrop={(files) => setAudioFile(files[0] ?? null)}
            progress={audioProgress}
            src={audioFile ? [audioFile] : undefined}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          <Dropzone
            accept={{ 'text/plain': ['.cue'] }}
            disabled={isBusy}
            maxFiles={1}
            onDrop={(files) => setCueFile(files[0] ?? null)}
            progress={cueProgress}
            src={cueFile ? [cueFile] : undefined}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          {error && (
            <div className="md:col-span-2 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
              <AlertTriangle className="size-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {jobId ? `Ready to start job ${jobId}` : 'We will name your uploads source.m4a/source.cue under the job prefix.'}
            </div>
            {cueValid === true ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-700 text-sm">
                <CheckCircle2 className="size-4" />
                CUE sheet valid
              </div>
            ): cueValid === false ? (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
                <AlertTriangle className="size-4" />
                CUE sheet invalid
              </div>
            ) : <></>}
            <Button disabled={actionDisabled} onClick={onAction} size="lg">
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : stage === 'uploaded' ? (
                <Scissors className="size-4" />
              ) : (
                <Upload className="size-4" />
              )}
              {actionLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
