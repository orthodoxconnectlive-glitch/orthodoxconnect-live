import { supabase } from '../lib/supabase';

export const BUNNY_LIBRARY_ID = '713265';
export const BUNNY_API_KEY = '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';
export const BUNNY_CDN_HOSTNAME = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';

/**
 * Uploads a video file directly to Bunny Stream REST API.
 * Returns the resulting Bunny Stream embed iframe URL.
 */
export async function uploadVideoToBunnyStream(
  file: File,
  title?: string
): Promise<string> {
  try {
    const videoTitle = title || file.name || `Orthodox_Video_${Date.now()}`;

    // 1. Create Video Object in Bunny Stream
    const createRes = await fetch(
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

    if (!createRes.ok) {
      throw new Error(`Bunny Stream create video HTTP ${createRes.status}`);
    }

    const createData = await createRes.json();
    const guid = createData.guid;

    if (!guid) {
      throw new Error('Bunny Stream create response missing video GUID');
    }

    // 2. Upload Video Binary Payload directly to Bunny Stream
    const uploadRes = await fetch(
      `https://video.mediadelivery.net/library/${BUNNY_LIBRARY_ID}/videos/${guid}`,
      {
        method: 'PUT',
        headers: {
          AccessKey: BUNNY_API_KEY,
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      }
    );

    if (!uploadRes.ok) {
      throw new Error(`Bunny Stream binary upload HTTP ${uploadRes.status}`);
    }

    // 3. Return iframe embed URL
    return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${guid}`;
  } catch (err) {
    console.warn('Bunny Stream upload error, falling back to storage upload:', err);
    return uploadMediaFile(file, 'post-videos');
  }
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
