import { retryWithBackoff } from "./retry-utils";

async function uploadToPresigned(
  url: string,
  file: File,
  fallbackType: string,
  onProgress?: (percent: number) => void,
) {
  const contentType = file.type || fallbackType;

  const attemptUpload = () =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onerror = () => reject(new Error('Network error uploading file'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.send(file);
    });

  await retryWithBackoff(attemptUpload);
}

export {
    uploadToPresigned
};

