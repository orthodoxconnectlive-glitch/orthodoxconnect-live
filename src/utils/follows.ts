const STORAGE_KEY = 'orthodoxconnect_followed_authors';

// Default initial followed accounts (empty array for real users)
const DEFAULT_FOLLOWED: string[] = [];

export function getFollowedAuthors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FOLLOWED));
      return DEFAULT_FOLLOWED;
    }
    return JSON.parse(raw) as string[];
  } catch {
    return DEFAULT_FOLLOWED;
  }
}

export function isFollowing(authorNameOrId: string): boolean {
  if (!authorNameOrId) return false;
  const followed = getFollowedAuthors();
  return followed.some(
    (item) => item.toLowerCase() === authorNameOrId.toLowerCase()
  );
}

export function toggleFollow(authorNameOrId: string): boolean {
  if (!authorNameOrId) return false;
  const followed = getFollowedAuthors();
  const index = followed.findIndex(
    (item) => item.toLowerCase() === authorNameOrId.toLowerCase()
  );

  let updated: string[];
  let isNowFollowing = false;

  if (index >= 0) {
    updated = followed.filter((_, i) => i !== index);
    isNowFollowing = false;
  } else {
    updated = [...followed, authorNameOrId];
    isNowFollowing = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('LocalStorage follow update failed:', err);
  }

  return isNowFollowing;
}

export function getFollowersCount(authorNameOrId: string): number {
  if (!authorNameOrId) return 12;
  let hash = 0;
  for (let i = 0; i < authorNameOrId.length; i++) {
    hash = (hash << 5) - hash + authorNameOrId.charCodeAt(i);
  }
  return Math.abs(hash % 180) + 24;
}

export function getFollowingCount(): number {
  return getFollowedAuthors().length;
}
