'use client';

import { CloudUpload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone';

export type UploadTrackCardProps = {
  isBusy: boolean;
  audioFile: File | null;
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  progress?: number | null;
};

const defaultAccept = {
  'audio/mpeg': ['.mp3'],
  'audio/m4a': ['.m4a'],
  'audio/wav': ['.wav'],
};

export function UploadTrackCard({ isBusy, audioFile, onDrop, accept = defaultAccept, progress = null }: UploadTrackCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <CloudUpload className="size-5" /> Upload Track
        </CardTitle>
        <CardDescription>Drop your source audio file to begin.</CardDescription>
      </CardHeader>
      <CardContent>
        <Dropzone
          accept={accept}
          disabled={isBusy}
          maxFiles={1}
          onDrop={onDrop}
          progress={progress}
          src={audioFile ? [audioFile] : undefined}
        >
          <DropzoneEmptyState />
          <DropzoneContent />
        </Dropzone>
      </CardContent>
    </Card>
  );
}
