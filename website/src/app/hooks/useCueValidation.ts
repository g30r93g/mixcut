import { useCallback, useEffect, useState } from 'react';
import type { CueTrackEntry, OverallDetails } from '@/components/tracklist-editor';
import { validateCue } from '@mixcut/parser';

type UseCueValidationArgs = {
  cueFile: File | null;
  tracks: CueTrackEntry[];
  overallDetails: OverallDetails;
  onError: (value: string | null) => void;
};

type UseCueValidationResult = {
  cueValid: boolean | null;
  resetCueValidation: () => void;
};

export function useCueValidation({
  cueFile,
  tracks,
  overallDetails,
  onError,
}: UseCueValidationArgs): UseCueValidationResult {
  const [cueValid, setCueValid] = useState<boolean | null>(null);

  const resetCueValidation = useCallback(() => {
    setCueValid(null);
  }, []);

  useEffect(() => {
    if (!cueFile && tracks.length === 0) {
      setCueValid(null);
      return;
    }

    try {
      const parsed = {
        fileName: cueFile?.name,
        title: overallDetails.title,
        performer: overallDetails.performer,
        genre: overallDetails.genre,
        releaseYear: overallDetails.releaseYear,
        tracks,
      };
      const validation = validateCue(parsed);
      if (!validation.ok) {
        throw new Error(validation.error || 'Invalid CUE sheet');
      }
      setCueValid(true);
      onError(null);
    } catch (err: unknown) {
      setCueValid(false);
      const message = err instanceof Error ? err.message : 'Invalid CUE sheet';
      onError(message);
    }
  }, [cueFile, overallDetails, onError, tracks]);

  return { cueValid, resetCueValidation };
}
