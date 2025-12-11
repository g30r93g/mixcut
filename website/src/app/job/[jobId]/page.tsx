'use client';

import { TracksDownload } from '@/components/tracks-download';
import { useParams } from 'next/navigation';

export default function JobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? null;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <TracksDownload jobId={jobId} />
    </main>
  );
}
