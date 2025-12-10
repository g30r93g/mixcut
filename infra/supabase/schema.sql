-- Jobs table: one CUE + one M4A = one job
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in (
    'PENDING_UPLOAD',
    'VALIDATING',
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
  )),
  audio_bucket text not null,
  audio_key text not null,
  artwork_bucket text,
  artwork_key text,
  cue_bucket text not null,
  cue_key text not null,
  output_bucket text,
  output_prefix text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_user_id_idx on public.jobs(user_id);

-- Tracks table: track metadata per job
create table public.job_tracks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  track_number int not null,
  title text not null,
  performer text,
  start_ms int not null,
  duration_ms int,
  output_key text,      -- S3 key to cut track
  created_at timestamptz not null default now()
);

create index job_tracks_job_id_idx on public.job_tracks(job_id);

-- simple updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_jobs_set_updated_at
before update on public.jobs
for each row
execute procedure public.set_updated_at();
