# mixcut

mixcut is a web-based tool for splitting long .m4a audio files into individual tracks using a provided CUE sheet.
Users upload a single large audio file and its corresponding .cue file, and mixcut returns properly segmented .m4a tracks.

The system uses:
- Supabase for database + optional user accounts
- AWS S3 for storage
- AWS Lambda (container) for running m4acut
- Next.js for the frontend
- A clean, service-oriented backend (validator, worker)
- A shared CUE parser library for both server and client

## How it works

1. User uploads assets (`.m4a` & `.cue`)

    The website requests a new job from the backend, receives presigned S3 upload URLs, and uploads both files directly to S3.

    Supabase records:
    - Job metadata
    - Upload locations
    - Initial job status (PENDING_UPLOAD)

2. Validation

    When the client calls `POST /jobs/:id/start`, the validator Lambda:
    1.	Downloads the .cue file
    2.	Validates and parses it with the shared parser library
    3.	Inserts track metadata into Supabase
    4.	Pushes a message onto SQS for processing
    5.	Updates job status to `QUEUED`

    If the CUE file is invalid, the job is marked `FAILED`.

3. Cutting with m4acut

    The worker Lambda runs inside a container image containing m4acut.

    For each job:
    1.	Downloads the .m4a + .cue from S3
    2.	Runs m4acut to slice the audio
    3.	Uploads each generated track to an outputs bucket
    4.	Updates each track record in Supabase with its S3 key
    5.	Marks the job `COMPLETED` (or `FAILED` on error)

4. User retrieves results

    The website queries Supabase for job status and displays all output tracks with download links.
