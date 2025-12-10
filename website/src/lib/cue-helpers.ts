import type { CueTrackEntry, OverallDetails } from '@/components/tracklist-editor';

export const emptyOverallDetails: OverallDetails = {
  title: '',
  performer: '',
  genre: '',
  releaseYear: '',
};

const escapeCueValue = (value: string) => value.replace(/"/g, '\\"');

const formatIndex = (ms: number) => {
  const framesPerSecond = 75;
  const totalFrames = Math.max(0, Math.round((ms / 1000) * framesPerSecond));
  const minutes = Math.floor(totalFrames / (framesPerSecond * 60));
  const remainingFrames = totalFrames - minutes * framesPerSecond * 60;
  const seconds = Math.floor(remainingFrames / framesPerSecond);
  const frames = remainingFrames - seconds * framesPerSecond;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const ff = frames.toString().padStart(2, '0');
  return `${mm}:${ss}:${ff}`;
};

type CueFileArgs = {
  entries: CueTrackEntry[];
  overallDetails: OverallDetails;
  audioFileName?: string;
};

export const buildCueFile = ({ entries, overallDetails, audioFileName }: CueFileArgs) => {
  if (!entries.length) {
    return null;
  }

  const lines: string[] = [];
  const { title, performer, genre, releaseYear } = overallDetails;
  const trimmedTitle = title.trim();
  const trimmedPerformer = performer.trim();
  const trimmedGenre = genre.trim();
  const trimmedReleaseYear = releaseYear.trim();

  if (trimmedTitle) {
    lines.push(`TITLE "${escapeCueValue(trimmedTitle)}"`);
  }
  if (trimmedPerformer) {
    lines.push(`PERFORMER "${escapeCueValue(trimmedPerformer)}"`);
  }
  if (trimmedGenre) {
    lines.push(`REM GENRE "${escapeCueValue(trimmedGenre)}"`);
  }
  if (trimmedReleaseYear) {
    lines.push(`REM DATE "${escapeCueValue(trimmedReleaseYear)}"`);
  }

  const fileLabel = audioFileName?.trim() || 'source.m4a';
  lines.push(`FILE "${escapeCueValue(fileLabel)}" MP4`);

  const sortedEntries = [...entries].sort((a, b) => a.trackNumber - b.trackNumber);
  for (const track of sortedEntries) {
    const trackTitle = track.title.trim() || `Track ${track.trackNumber}`;
    const trackPerformer = track.performer?.trim();
    const paddedTrackNumber = track.trackNumber.toString().padStart(2, '0');
    lines.push(`  TRACK ${paddedTrackNumber} AUDIO`);
    lines.push(`    TITLE "${escapeCueValue(trackTitle)}"`);
    if (trackPerformer) {
      lines.push(`    PERFORMER "${escapeCueValue(trackPerformer)}"`);
    }
    lines.push(`    INDEX 01 ${formatIndex(track.startMs)}`);
  }

  const cueContents = `${lines.join('\n')}\n`;
  const blob = new Blob([cueContents], { type: 'text/plain' });
  return new File([blob], 'source.cue', { type: 'text/plain' });
};
