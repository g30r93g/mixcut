import { framesToMs } from "@mixcut/shared";
import { CueTrack, ParsedCue } from "./lib/types";

const FILE_RE = /^FILE\s+"(.+?)"\s+(.+)$/i;
const TRACK_RE = /^TRACK\s+(\d+)\s+(\w+)/i;
const TITLE_RE = /^TITLE\s+"(.+?)"$/i;
const PERFORMER_RE = /^PERFORMER\s+"(.+?)"$/i;
const INDEX_RE = /^INDEX\s+01\s+(\d{2}):(\d{2}):(\d{2})$/i;

export function parseCue(cueText: string): ParsedCue {
  const lines = cueText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("REM ")); // drop comments

  let fileName: string | undefined;
  const tracks: CueTrack[] = [];

  let currentTrackNumber: number | undefined;
  let currentTitle: string | undefined;
  let currentPerformer: string | undefined;
  let currentStartMs: number | undefined;

  const flushTrack = () => {
    if (
      currentTrackNumber !== undefined &&
      currentTitle !== undefined &&
      currentStartMs !== undefined
    ) {
      tracks.push({
        trackNumber: currentTrackNumber,
        title: currentTitle,
        performer: currentPerformer,
        startMs: currentStartMs
      });
    }
  };

  for (const raw of lines) {
    if (FILE_RE.test(raw)) {
      const m = raw.match(FILE_RE)!;
      fileName = m[1];
      continue;
    }

    if (TRACK_RE.test(raw)) {
      // new track begins – flush previous
      flushTrack();

      const m = raw.match(TRACK_RE)!;
      currentTrackNumber = parseInt(m[1], 10);
      currentTitle = undefined;
      currentPerformer = undefined;
      currentStartMs = undefined;
      continue;
    }

    if (TITLE_RE.test(raw)) {
      const m = raw.match(TITLE_RE)!;
      currentTitle = m[1];
      continue;
    }

    if (PERFORMER_RE.test(raw)) {
      const m = raw.match(PERFORMER_RE)!;
      currentPerformer = m[1];
      continue;
    }

    if (INDEX_RE.test(raw)) {
      const m = raw.match(INDEX_RE)!;
      const mm = parseInt(m[1], 10);
      const ss = parseInt(m[2], 10);
      const ff = parseInt(m[3], 10);
      currentStartMs = framesToMs(mm, ss, ff);
      continue;
    }

    // Ignore other directives for now (CATALOG, ISRC, etc.)
  }

  // flush final track
  flushTrack();

  return { fileName, tracks };
}
