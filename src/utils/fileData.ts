export function decodeDataUrlText(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const firstComma = dataUrl.indexOf(',');
  if (firstComma === -1) {
    throw new Error('Invalid data URL.');
  }

  const metadata = dataUrl.slice(0, firstComma);
  const payload = dataUrl.slice(firstComma + 1);

  if (/;base64/i.test(metadata)) {
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return decodeURIComponent(payload);
}

export async function generateVideoThumbnailDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('video/')) {
    return undefined;
  }

  return new Promise<string | undefined>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    let awaitingSeek = false;

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const finish = (result?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const capture = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish(undefined);
        return;
      }

      const scale = Math.min(1, 480 / video.videoWidth, 270 / video.videoHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        finish(undefined);
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      finish(canvas.toDataURL('image/jpeg', 0.82));
    };

    const timeoutId = window.setTimeout(() => finish(undefined), 5000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('error', () => finish(undefined), { once: true });
    video.addEventListener('seeked', () => {
      window.clearTimeout(timeoutId);
      capture();
    }, { once: true });
    video.addEventListener('loadeddata', () => {
      if (!awaitingSeek) {
        window.clearTimeout(timeoutId);
        capture();
      }
    }, { once: true });
    video.addEventListener('loadedmetadata', () => {
      const targetTime = Number.isFinite(video.duration) && video.duration > 0.1 ? 0.1 : 0;
      if (targetTime <= 0) {
        return;
      }

      awaitingSeek = true;
      try {
        video.currentTime = targetTime;
      } catch {
        awaitingSeek = false;
      }
    }, { once: true });

    video.src = objectUrl;
    video.load();
  });
}
