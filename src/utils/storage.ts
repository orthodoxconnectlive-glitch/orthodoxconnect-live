import { supabase } from '../lib/supabase';

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
 * Uploads a video file directly to Bunny Stream REST API.
 * 1. Creates video object to obtain GUID.
 * 2. Uploads binary data directly to Bunny Stream.
 * Returns the video GUID and embed iframe URL.
 */
export async function uploadVideoToBunnyStream(
  file: File,
  title?: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const libraryId = BUNNY_LIBRARY_ID || '713265';
  const videoTitle = title || file.name || `Orthodox_Video_${Date.now()}`;
  let guid: string | null = null;
  let directUploadUrl = '';

  // 1. First, call POST /api/bunny/create-video to get the container guid
  try {
    const res = await fetch('/api/bunny/create-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: videoTitle }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.guid) {
        guid = data.guid;
        directUploadUrl =
          data.directUploadUrl ||
          `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;
      }
    } else {
      console.warn('[storage] /api/bunny/create-video returned status:', res.status);
    }
  } catch (e) {
    console.warn('[storage] /api/bunny/create-video helper error:', e);
  }

  // Fallback to direct Bunny Stream REST API if backend proxy failed
  if (!guid) {
    try {
      const createRes = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos`,
        {
          method: 'POST',
          headers: {
            AccessKey: BUNNY_API_KEY,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ title: videoTitle }),
        }
      );

      if (createRes.ok) {
        const createData = await createRes.json();
        guid = createData.guid;
        directUploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;
      }
    } catch (createErr) {
      console.warn('[storage] Direct Bunny create video error:', createErr);
    }
  }

  if (!guid) {
    throw new Error('Failed to create Bunny Stream video container (GUID could not be generated).');
  }

  // 2. Second, await the binary upload PUT request to Bunny Stream (https://video.bunnycdn.com/library/713265/videos/${guid})
  const uploadUrl =
    directUploadUrl || `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('AccessKey', BUNNY_API_KEY);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

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

  // 3. ONLY AFTER the PUT request returns status 200/OK, return guid
  return guid;
}

/**
 * Helper to build the canonical Bunny Stream iframe embed URL for a given videoId/GUID.
 */
export function getBunnyEmbedIframeUrl(videoId: string): string {
  const libraryId = BUNNY_LIBRARY_ID;
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true`;
}

/**
 * Uploads a file to Supabase Storage bucket or converts to persistent Data URL.
 * Ensures image, video, and audio uploads persist reliably across page refreshes.
 */
export async function uploadMediaFile(
  file: File,
  bucketName: string = 'media'
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `${fileName}`;

  try {
    // Attempt Supabase storage bucket upload
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('Supabase storage upload error, falling back to local persistent Data URL:', err);
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

