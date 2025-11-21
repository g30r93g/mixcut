type CueTrack = {
  trackNumber: number;
  title: string;
  performer?: string;
  startMs: number;
};

type ParsedCue = {
  fileName?: string;
  tracks: CueTrack[];
};
