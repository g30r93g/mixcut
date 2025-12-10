import { buildGatewayHeaders, gatewayUrl } from '@/lib/gateway-client';
import { retryWithBackoff } from '@/lib/retry-utils';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

export async function POST() {
  // todo: implement
  // const userId = await requireUserId();
  // if (!userId) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const response = await retryWithBackoff(() =>
      fetch(gatewayUrl('/jobs'), {
        method: 'POST',
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
    const message = err instanceof Error ? err.message : 'Failed to create job';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
