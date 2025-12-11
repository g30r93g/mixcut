export function framesToMs(minutes: number, seconds: number, frames: number) {
  // m4a/CUE uses 75 frames per second
  return (minutes * 60 + seconds) * 1000 + Math.round(frames * (1000 / 75));
}
