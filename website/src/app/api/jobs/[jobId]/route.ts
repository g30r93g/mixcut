import { buildGatewayHeaders, gatewayUrl } from '@/lib/gateway-client';
import { retryWithBackoff } from '@/lib/retry-utils';
import { NextRequest, NextResponse } from 'next/server';

type JobRouteParams = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, context: JobRouteParams) {
  // todo: implement
  // const userId = await requireUserId();
  // if (!userId) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
  }

  try {
    const response = await retryWithBackoff(() =>
      fetch(gatewayUrl(`/jobs/${jobId}`), {
        headers: buildGatewayHeaders(),
      }),
    );

    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? 'text/plain';

    return new NextResponse(text, {
      status: response.status,
      headers: { 'content-type': contentType },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch job';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
