export const BUNNY_LIBRARY_ID =
  import.meta.env.VITE_BUNNY_LIBRARY_ID || '713265';
export const BUNNY_API_KEY =
  import.meta.env.VITE_BUNNY_API_KEY || '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';
export const BUNNY_CDN_HOSTNAME =
  import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';

export interface BunnyUploadResult {
  guid: string;
  embedUrl: string;
  libraryId: string;
}

/**
 * Compresses an image file client-side using HTML5 Canvas to max width 800px and quality 0.70.
 * Eliminates oversized base64 payloads to avoid Cloudflare D1 / SQLite SQLITE_TOOBIG errors.
 */
export async function compressImageToDataUrl(
  file: File,
  maxWidth: number = 800,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If SVG or animated GIF, read as regular Data URL
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(readerEvent.target?.result as string);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a video file directly to Bunny Stream REST API with two-step handoff:
 * Step A: POST https://video.bunnycdn.com/library/713265/videos with body { title } to obtain guid
 * Step B: PUT https://video.bunnycdn.com/library/713265/videos/${guid} with binary octet-stream
 * Only resolves when HTTP status is 2xx and binary upload is 100% complete.
 */
export async function uploadVideoToBunnyStream(
  file: File,
  title?: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const libraryId = BUNNY_LIBRARY_ID || '713265';
  const apiKey = BUNNY_API_KEY || '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';
  const videoTitle = title || file.name || `Orthodox_Video_${Date.now()}`;
  let guid: string | null = null;

  // Step A: Create Video Object in Bunny Stream
  try {
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ title: videoTitle }),
      }
    );

    if (createRes.ok) {
      const createData = await createRes.json();
      guid = createData.guid;
    } else {
      console.warn('[Bunny Direct Create] returned status:', createRes.status);
    }
  } catch (createErr) {
    console.warn('[Bunny Direct Create] network error:', createErr);
  }

  // Fallback to Worker API endpoint if direct create failed (e.g. CORS)
  if (!guid) {
    try {
      const proxyRes = await fetch('/api/bunny/create-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: videoTitle }),
      });

      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        if (proxyData?.guid) {
          guid = proxyData.guid;
        }
      }
    } catch (proxyErr) {
      console.warn('[Bunny Proxy Create] error:', proxyErr);
    }
  }

  if (!guid) {
    throw new Error('Failed to initialize Bunny Stream video container (GUID generation failed).');
  }

  // Step B: Stream binary using XMLHttpRequest PUT
  const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('AccessKey', apiKey);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('accept', 'application/json');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        reject(
          new Error(
            `Bunny Stream binary upload PUT failed with status ${xhr.status}: ${xhr.statusText || 'Upload rejected'}`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during Bunny Stream binary PUT upload.'));
    };

    xhr.send(file);
  });

  return guid;
}

/**
 * Helper to build the canonical Bunny Stream iframe embed URL for a given videoId/GUID.
 */
export function getBunnyEmbedIframeUrl(videoId: string): string {
  const libraryId = BUNNY_LIBRARY_ID || '713265';
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;
}

/**
 * Uploads/prepares media file (compresses images to optimized Data URLs for Cloudflare D1 storage).
 */
export async function uploadMediaFile(
  file: File,
  _bucketName: string = 'media'
): Promise<string> {
  // If image, compress via HTML5 canvas to keep size well under SQLite limits
  if (file.type.startsWith('image/')) {
    return compressImageToDataUrl(file, 800, 0.7);
  }

  // Fallback: Read file as Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
