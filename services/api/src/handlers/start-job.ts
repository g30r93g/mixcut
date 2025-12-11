import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { badRequest, internalError, json, notFound } from '../lib/http';
import { supabase } from '../lib/supabase';

const lambdaClient = new LambdaClient({});

const VALIDATOR_FUNCTION_NAME = process.env.VALIDATOR_FUNCTION_NAME;
if (!VALIDATOR_FUNCTION_NAME) {
  throw new Error('VALIDATOR_FUNCTION_NAME must be set');
}

export async function handleStartJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const jobId = event.pathParameters?.id;

  if (!jobId) {
    return badRequest('Missing job id');
  }

  try {
    // 1. Load job
    const { data: job, error: jobErr } = await supabase.from('jobs').select('*').eq('id', jobId).single();

    if (jobErr || !job) {
      return notFound('Job not found');
    }

    if (job.status !== 'PENDING_UPLOAD') {
      return badRequest(`Job cannot be started from status ${job.status}. Expected PENDING_UPLOAD.`);
    }

    // 2. Mark as VALIDATING
    const { error: updateErr } = await supabase
      .from('jobs')
      .update({
        status: 'VALIDATING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateErr) {
      console.error('Failed to update job status to VALIDATING', updateErr);
      return internalError('Failed to update job');
    }

    // 3. Invoke validator lambda asynchronously
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: VALIDATOR_FUNCTION_NAME,
        InvocationType: 'Event', // async
        Payload: Buffer.from(JSON.stringify({ jobId }), 'utf8'),
      }),
    );

    return json(202, { ok: true });
  } catch (err: any) {
    console.error('handleStartJob error', err);
    return internalError('Unexpected error starting job');
  }
}
