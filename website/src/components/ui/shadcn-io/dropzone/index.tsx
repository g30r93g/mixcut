'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, UploadIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { DropEvent, DropzoneOptions, FileRejection } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';

type DropzoneContextType = {
  src?: File[];
  accept?: DropzoneOptions['accept'];
  maxSize?: DropzoneOptions['maxSize'];
  minSize?: DropzoneOptions['minSize'];
  maxFiles?: DropzoneOptions['maxFiles'];
};

const renderBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)}${units[unitIndex]}`;
};

const DropzoneContext = createContext<DropzoneContextType | undefined>(
  undefined
);

export type DropzoneProps = Omit<DropzoneOptions, 'onDrop'> & {
  src?: File[];
  className?: string;
  onDrop?: (
    acceptedFiles: File[],
    fileRejections: FileRejection[],
    event: DropEvent
  ) => void;
  /** Optional upload progress (0-100). When provided, a progress bar will be shown. */
  progress?: number | null;
  children?: ReactNode;
};

export const Dropzone = ({
  accept,
  maxFiles = 1,
  maxSize,
  minSize,
  onDrop,
  onError,
  disabled,
  src,
  className,
  progress,
  children,
  ...props
}: DropzoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles,
    maxSize,
    minSize,
    onError,
    disabled,
    onDrop: (acceptedFiles, fileRejections, event) => {
      if (fileRejections.length > 0) {
        const message = fileRejections.at(0)?.errors.at(0)?.message;
        onError?.(new Error(message));
        return;
      }

      onDrop?.(acceptedFiles, fileRejections, event);
    },
    ...props,
  });

  return (
    <DropzoneContext.Provider
      key={JSON.stringify(src)}
      value={{ src, accept, maxSize, minSize, maxFiles }}
    >
      <Button
      className={cn(
        'relative h-auto w-full flex-col overflow-hidden p-8',
        isDragActive && 'outline-none ring-1 ring-ring',
        className
      )}
        disabled={disabled}
        type="button"
        variant="outline"
        {...getRootProps()}
      >
        <input {...getInputProps()} disabled={disabled} />
        {children}
        {typeof progress === 'number' && (
          <div className="absolute inset-x-0 bottom-0">
            <div className="flex items-center gap-2 px-3 pb-3 text-xs text-muted-foreground">
              {progress >= 100 ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              )}
              <span>{progress >= 100 ? 'Upload complete' : 'Uploading…'}</span>
            </div>
            <div className="h-1 w-full bg-muted">
              <div
                className="h-1 bg-primary transition-all"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
          </div>
        )}
      </Button>
    </DropzoneContext.Provider>
  );
};

const useDropzoneContext = () => {
  const context = useContext(DropzoneContext);

  if (!context) {
    throw new Error('useDropzoneContext must be used within a Dropzone');
  }

  return context;
};

export type DropzoneContentProps = {
  children?: ReactNode;
  className?: string;
};

const maxLabelItems = 3;

export const DropzoneContent = ({
  children,
  className,
}: DropzoneContentProps) => {
  const { src } = useDropzoneContext();
  const imageFile = useMemo(
    () => src?.find((file) => file.type?.startsWith('image/')),
    [src],
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  if (!src) {
    return null;
  }

  if (children) {
    return children;
  }

  if (previewUrl) {
    return (
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 text-center',
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={imageFile?.name || 'Uploaded image preview'}
          className="h-32 w-32 rounded-md object-cover shadow-sm"
        />
        <p className="w-full truncate font-medium text-sm">{imageFile?.name}</p>
        <p className="w-full text-xs text-muted-foreground">Drag and drop or click to replace</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <UploadIcon size={16} />
      </div>
      <p className="my-2 w-full truncate font-medium text-sm">
        {src.length > maxLabelItems
          ? `${new Intl.ListFormat('en').format(
              src.slice(0, maxLabelItems).map((file) => file.name)
            )} and ${src.length - maxLabelItems} more`
          : new Intl.ListFormat('en').format(src.map((file) => file.name))}
      </p>
      <p className="w-full text-wrap text-muted-foreground text-xs">
        Drag and drop or click to replace
      </p>
    </div>
  );
};

export type DropzoneEmptyStateProps = {
  children?: ReactNode;
  className?: string;
};

export const DropzoneEmptyState = ({
  children,
  className,
}: DropzoneEmptyStateProps) => {
  const { src, accept, maxSize, minSize, maxFiles } = useDropzoneContext();

  if (src) {
    return null;
  }

  if (children) {
    return children;
  }

  let caption = '';

  if (accept) {
    caption += 'Accepts ';
    caption += new Intl.ListFormat('en').format(Object.keys(accept));
  }

  if (minSize && maxSize) {
    caption += ` between ${renderBytes(minSize)} and ${renderBytes(maxSize)}`;
  } else if (minSize) {
    caption += ` at least ${renderBytes(minSize)}`;
  } else if (maxSize) {
    caption += ` less than ${renderBytes(maxSize)}`;
  }

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <UploadIcon size={16} />
      </div>
      <p className="my-2 w-full truncate text-wrap font-medium text-sm">
        Upload {maxFiles === 1 ? 'a file' : 'files'}
      </p>
      <p className="w-full truncate text-wrap text-muted-foreground text-xs">
        Drag and drop or click to upload
      </p>
      {caption && (
        <p className="text-wrap text-muted-foreground text-xs">{caption}.</p>
      )}
    </div>
  );
};
