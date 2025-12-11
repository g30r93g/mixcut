import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleBundleJob } from './handlers/bundle-job';
import { handleCreateJob } from './handlers/create-job';
import { handleGetJob } from './handlers/get-job';
import { handleStartJob } from './handlers/start-job';
import { json, methodNotAllowed } from './lib/http';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, {});
  }

  const { resource, httpMethod } = event;

  try {
    if (resource === '/jobs') {
      if (httpMethod === 'POST') {
        return handleCreateJob(event);
      }
      return methodNotAllowed();
    }

    if (resource === '/jobs/{id}') {
      if (httpMethod === 'GET') {
        return handleGetJob(event);
      }
      return methodNotAllowed();
    }

    if (resource === '/jobs/{id}/start') {
      if (httpMethod === 'POST') {
        return handleStartJob(event);
      }
      return methodNotAllowed();
    }

    if (resource === '/jobs/{id}/bundle') {
      if (httpMethod === 'GET') {
        return handleBundleJob(event);
      }
      return methodNotAllowed();
    }

    // Fallback 404
    return json(404, { error: 'Not found' });
  } catch (err: any) {
    console.error('Unhandled error in root handler', err);
    return json(500, { error: 'Internal server error' });
  }
}
