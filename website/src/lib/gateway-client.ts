const gatewayEnv = process.env.GATEWAY_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL;

if (!gatewayEnv) {
  throw new Error('GATEWAY_URL (or NEXT_PUBLIC_GATEWAY_URL) is required for gateway calls');
}

const gatewayBase = gatewayEnv.replace(/\/$/, '');

export function gatewayUrl(path: string) {
  return `${gatewayBase}${path}`;
}

export function buildGatewayHeaders(userId?: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  if (process.env.AWS_API_KEY) {
    headers.set('x-api-key', process.env.AWS_API_KEY);
  }
  if (userId) {
    headers.set('x-user-id', userId);
  }
  return headers;
}
