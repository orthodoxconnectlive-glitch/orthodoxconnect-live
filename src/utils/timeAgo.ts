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
