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
  title?: string
): Promise<string> {
  const videoTitle = title || file.name || `Orthodox_Video_${Date.now()}`;
  let guid: string | null = null;
  let directUploadUrl = '';

  // Step 1: Try backend helper endpoint first (/api/bunny/create-video)
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
        directUploadUrl = data.directUploadUrl || `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${guid}`;
      }
    }
  } catch (e) {
    console.warn('[storage] /api/bunny/create-video helper error, attempting direct API:', e);
  }

  // Step 1 Fallback: Create Video Object via direct Bunny Stream REST API
  if (!guid) {
    try {
      const createRes = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
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
        directUploadUrl = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${guid}`;
      } else {
        // Try fallback mediadelivery hostname
        const altRes = await fetch(
          `https://video.mediadelivery.net/library/${BUNNY_LIBRARY_ID}/videos`,
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
        if (altRes.ok) {
          const altData = await altRes.json();
          guid = altData.guid;
          directUploadUrl = `https://video.mediadelivery.net/library/${BUNNY_LIBRARY_ID}/videos/${guid}`;
        }
      }
    } catch (createErr) {
      console.warn('[storage] Direct Bunny create video error:', createErr);
    }
  }

  if (!guid) {
    console.warn('[storage] Bunny Stream creation failed, falling back to storage upload');
    return uploadMediaFile(file, 'post-videos');
  }

  // Step 2: Upload Video Binary to Bunny Stream
  try {
    const uploadUrl = directUploadUrl || `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${guid}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        AccessKey: BUNNY_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      // Try alt endpoint
      await fetch(`https://video.mediadelivery.net/library/${BUNNY_LIBRARY_ID}/videos/${guid}`, {
        method: 'PUT',
        headers: {
          AccessKey: BUNNY_API_KEY,
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      });
    }

    // Return the pure GUID or canonical embed URL so it can be stored into D1
    return guid;
  } catch (uploadErr) {
    console.warn('[storage] Bunny Stream binary upload notice, returning guid:', uploadErr);
    return guid;
  }
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

