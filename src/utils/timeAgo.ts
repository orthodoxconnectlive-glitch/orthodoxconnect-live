export function formatTimeAgo(dateInput?: string | Date | number, lang: 'en' | 'ar' = 'en'): string {
  const isArabic = lang === 'ar';
  if (!dateInput) return isArabic ? 'الآن' : 'JUST NOW';

  // If dateInput is a string like 'Just now' or '2 hours ago', handle it gracefully
  if (typeof dateInput === 'string' && (dateInput.toLowerCase().includes('now') || dateInput.toLowerCase().includes('ago'))) {
    return isArabic ? 'الآن' : dateInput.toUpperCase();
  }

  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return isArabic ? 'الآن' : 'JUST NOW';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 45) {
    return isArabic ? 'الآن' : 'JUST NOW';
  } else if (diffInSeconds < 90) {
    return isArabic ? 'منذ دقيقة' : '1m ago';
  } else if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return isArabic ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return isArabic ? `منذ ${hours} ساعة` : `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return isArabic ? `منذ ${days} يوم` : `${days}d ago`;
  } else {
    return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  }
}

// ---- Real presence helpers (2026-09-28) ----
// "Online" = seen in the last 5 minutes. Anything older shows "Active X ago".
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

export function isRecentlyActive(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  const ms = Date.parse(lastSeen);
  if (isNaN(ms)) return false;
  const diff = Date.now() - ms;
  return diff >= 0 && diff < PRESENCE_WINDOW_MS;
}

export function presenceLabel(lastSeen: string | null | undefined, lang: string = 'en'): string {
  const ar = lang === 'ar';
  if (!lastSeen) return ar ? 'غير متصل' : 'Offline';
  const diff = Date.now() - Date.parse(lastSeen);
  if (isNaN(diff) || diff < 0) return ar ? 'غير متصل' : 'Offline';
  if (diff < PRESENCE_WINDOW_MS) return ar ? 'متصل الآن' : 'Active now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return ar ? `نشط منذ ${mins} د` : `Active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return ar ? `نشط منذ ${hrs} س` : `Active ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return ar ? `نشط منذ ${days} يوم` : `Active ${days}d ago`;
}
