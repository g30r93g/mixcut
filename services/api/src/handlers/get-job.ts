import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Job, Track } from '@mixcut/shared';
import { badRequest, internalError, json, notFound } from '../lib/http';
import { supabase } from '../lib/supabase';

export async function handleGetJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const jobId = event.pathParameters?.id;

  if (!jobId) {
    return badRequest('Missing job id');
  }

  try {
    const { data: job, error: jobErr } = await supabase.from('jobs').select('*').eq('id', jobId).single();

    if (jobErr || !job) {
      return notFound('Job not found');
    }

    const { data: tracks, error: tracksErr } = await supabase
      .from('job_tracks')
      .select('*')
      .eq('job_id', jobId)
      .order('track_number', { ascending: true });

    if (tracksErr) {
      console.error('Failed to load tracks', tracksErr);
      return internalError('Failed to load tracks');
    }

    const typedJob = job as Job;
    const typedTracks = (tracks ?? []) as Track[];

    return json(200, {
      job: typedJob,
      tracks: typedTracks,
    });
  } catch (err: any) {
    console.error('handleGetJob error', err);
    return internalError('Unexpected error loading job');
  }
}
