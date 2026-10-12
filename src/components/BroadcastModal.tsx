import React from 'react';
import { Megaphone, X } from 'lucide-react';
import { NotificationItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import { localizeNotification } from '../utils/notificationText';

interface BroadcastModalProps {
  notif: NotificationItem | null;
  onClose: () => void;
}

// Full-screen reader for broadcast (announcement) notifications.
// Tapping a broadcast opens this instead of navigating away, so the
// complete message is always readable.
export const BroadcastModal: React.FC<BroadcastModalProps> = ({ notif, onClose }) => {
  const { language } = useTheme();
  const ar = language === 'ar';

  if (!notif) return null;

  const { body } = localizeNotification(notif, ar ? 'ar' : 'en');
  let when = '';
  try {
    if (notif.createdAt) {
      when = new Date(notif.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  } catch {
    when = '';
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-(--bg-card) dark:bg-[#1c1611] border-2 border-(--ln-gold) dark:border-[#8b6b4a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center gap-3 p-4 border-b border-(--ln-gold)/20 bg-(--bg-card) dark:bg-[#1c1611] rounded-t-3xl">
          <div className="w-11 h-11 rounded-2xl bg-(--ac-gold)/15 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif font-bold text-sm text-(--tx-head)">
              {ar ? 'إعلان' : 'Announcement'}
            </p>
            {when ? <p className="text-[10px] text-(--tx-soft) mt-0.5">{when}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-(--tx-soft) hover:text-(--tx-head) hover:bg-(--bg-inset) transition-all cursor-pointer"
            aria-label={ar ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {notif.mediaUrl && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-(--ln-gold)/30">
              {notif.mediaType === 'video' ? (
                <video src={notif.mediaUrl} className="w-full max-h-72 object-contain bg-black" controls playsInline />
              ) : (
                <img src={notif.mediaUrl} alt="" className="w-full max-h-72 object-contain bg-black" loading="lazy" />
              )}
            </div>
          )}
          <p className="text-sm text-(--tx-body) leading-relaxed whitespace-pre-wrap break-words">{body}</p>
        </div>
      </div>
    </div>
  );
};
