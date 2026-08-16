import { supabase } from '../lib/supabase';

export const BUNNY_LIBRARY_ID = '713265';
export const BUNNY_API_KEY = '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';
export const BUNNY_CDN_HOSTNAME = 'vz-840ad26e-6fe.b-cdn.net';

export interface BunnyUploadResult {
  guid: string;
  embedUrl: string;
  libraryId: string;
}

/**
 * Uploads a video file directly to Bunny Stream REST API with guaranteed binary delivery.
 */
export async function uploadVideoToBunnyStream(
  file: File,
  title?: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const libraryId = BUNNY_LIBRARY_ID;
  const apiKey = BUNNY_API_KEY;
  const videoTitle = title || file.name || `Orthodox_Video_${Date.now()}`;
  let guid: string | null = null;

  // Step 1: Create Video Container in Bunny Stream
  try {
    const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ title: videoTitle }),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      guid = createData.guid;
    } else {
      const errText = await createRes.text();
      console.warn('[Bunny Direct Create Failed]:', createRes.status, errText);
    }
  } catch (err) {
    console.warn('[Bunny Direct Create Exception]:', err);
  }

  // Fallback to worker route if direct create fails
  if (!guid) {
    const workerRes = await fetch('/api/bunny/create-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: videoTitle }),
    });
    if (workerRes.ok) {
      const workerData = await workerRes.json();
      guid = workerData.guid;
    }
  }

  if (!guid) {
    throw new Error('Failed to create Bunny Stream video container (No GUID generated).');
  }

  // Step 2: Stream Raw Binary PUT to Bunny Stream
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, true);
    
    xhr.setRequestHeader('AccessKey', apiKey);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('accept', 'application/json');

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
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
        reject(new Error(`Bunny video binary upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during Bunny video binary upload.'));
    xhr.ontimeout = () => reject(new Error('Bunny video upload timed out.'));

    xhr.send(file);
  });

  return guid;
}

/**
 * Helper to build the canonical Bunny Stream iframe embed URL.
 */
export function getBunnyEmbedIframeUrl(videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}?autoplay=false&loop=false&muted=false&preload=true`;
}

/**
 * Uploads media file to Supabase or converts to persistent data URL.
 */
export async function uploadMediaFile(
  file: File,
  bucketName: string = 'media'
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png';
  const filePath = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  try {
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
    console.warn('Supabase storage fallback:', err);
  }

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
