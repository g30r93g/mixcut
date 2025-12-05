import { gatewayUrl, buildGatewayHeaders } from '@/lib/gateway-client';
import { retryWithBackoff } from '@/lib/retry-utils';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = params.jobId;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
  }

  try {
    const response = await retryWithBackoff(() =>
      fetch(gatewayUrl(`/jobs/${jobId}/start`), {
        method: 'POST',
        headers: buildGatewayHeaders(userId),
      }),
    );

    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? 'text/plain';

    return new NextResponse(text, {
      status: response.status,
      headers: { 'content-type': contentType },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start job';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
