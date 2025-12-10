import { buildGatewayHeaders, gatewayUrl } from '@/lib/gateway-client';
import { retryWithBackoff } from '@/lib/retry-utils';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // todo: implement
  // const userId = await requireUserId();
  // if (!userId) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const body = await request.text();
    const contentType = request.headers.get('content-type') ?? undefined;
    const headers = buildGatewayHeaders(undefined, contentType ? {
      'content-type': contentType
    } : undefined);

    const response = await retryWithBackoff(() =>
      fetch(gatewayUrl('/jobs'), {
        method: 'POST',
        headers,
        body: body.length > 0 ? body : undefined,
      }),
    );

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: contentType ? { 'content-type': contentType } : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create job';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
