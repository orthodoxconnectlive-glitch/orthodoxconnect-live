// One share path for web + native (Hany, 2026-11-19).
// The Android WebView has no navigator.share, so the web code path silently
// fell back to copying the link in the app. On native, use the Capacitor
// Share plugin (native share sheet); on the web, keep navigator.share with
// the clipboard copy as the fallback. Returns 'shared' when the sheet opened
// (or the user picked a target) and 'copied' when the text was copied instead.
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { isNativeApp } from './nativePush';

export type ShareResult = 'shared' | 'copied';

export async function shareContent(opts: {
  title: string;
  text: string;
  url?: string;
  imageBlob?: Blob | null;
}): Promise<ShareResult> {
  const { title, text, url, imageBlob } = opts;
  const fullText = url ? `${text}\n\n${url}` : text;

  if (isNativeApp()) {
    try {
      if (imageBlob) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(imageBlob);
        });
        const saved = await Filesystem.writeFile({
          path: 'orthodoxconnect-share.png',
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({ title, text: fullText, files: [saved.uri], dialogTitle: 'Share' });
      } else {
        await Share.share({ title, text: fullText, url, dialogTitle: 'Share' });
      }
      return 'shared';
    } catch {
      // Share sheet dismissed or unavailable — fall through to the copy.
      try {
        await Share.share({ title, text: fullText, url, dialogTitle: 'Share' });
        return 'shared';
      } catch {
        /* ignore — nothing more we can do */
      }
      return 'copied';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (imageBlob && navigator.canShare) {
        const file = new File([imageBlob], 'orthodoxconnect-post.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text: fullText });
          return 'shared';
        }
      }
      await navigator.share({ title, text: fullText, url });
      return 'shared';
    } catch {
      /* user dismissed the sheet — treat as shared, do not copy */
      return 'shared';
    }
  }

  try {
    await navigator.clipboard.writeText(fullText);
  } catch {
    /* clipboard unavailable */
  }
  return 'copied';
}
