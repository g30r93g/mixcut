import { useEffect, useMemo } from 'react';

export function useObjectUrl(file: File | null) {
  const objectUrl = useMemo(() => {
    if (!file) {
      return '';
    }
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!objectUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return objectUrl;
}
