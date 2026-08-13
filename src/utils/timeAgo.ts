export function formatTimeAgo(dateInput?: string | Date | number): string {
  if (!dateInput) return 'JUST NOW';
  
  // If dateInput is a string like 'Just now' or '2 hours ago', handle it gracefully
  if (typeof dateInput === 'string' && (dateInput.toLowerCase().includes('now') || dateInput.toLowerCase().includes('ago'))) {
    return dateInput.toUpperCase();
  }

  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return 'JUST NOW';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 45) {
    return 'JUST NOW';
  } else if (diffInSeconds < 90) {
    return '1m ago';
  } else if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
