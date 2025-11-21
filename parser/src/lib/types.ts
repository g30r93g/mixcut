export interface CueTrack {
  trackNumber: number;
  title: string;
  performer?: string;
  startMs: number;
}

export interface ParsedCue {
  fileName?: string;
  tracks: CueTrack[];
}

export type CueValidationResult =
  | {
      ok: true;
      tracks: CueTrack[];
    }
  | {
      ok: false;
      error: string;
    };
