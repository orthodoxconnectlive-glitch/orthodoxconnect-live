// Follow store.
//
// Follows are keyed by the user's stable id when available (display names can
// change, and the same name can be spelled or formatted differently across
// surfaces). Entries are { id?, name } records; legacy plain-string entries
// are migrated on read.
//
// localStorage writes can silently fail on some devices (full quota, webview
// restrictions) while the UI still updates from React state — which looks
// exactly like "follow works until refresh". Every write is verified with a
// read-back; if it did not stick, records are kept in a module-level
// in-memory store so the session stays consistent, and the detailed toggle
// reports persisted:false so the UI can say so honestly.

export interface FollowRecord {
  id?: string;
  name: string;
}

const STORAGE_KEY = 'orthodoxconnect_followed_authors';

let memoryFallback: FollowRecord[] | null = null;

function normalize(records: unknown): FollowRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((e: any): FollowRecord | null => {
      if (typeof e === 'string') return e ? { name: e } : null;
      if (e && typeof e.name === 'string' && e.name) {
        return { id: typeof e.id === 'string' ? e.id : undefined, name: e.name };
      }
      return null;
    })
    .filter((e): e is FollowRecord => e !== null);
}

function readStored(): FollowRecord[] {
  if (memoryFallback) return memoryFallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalize(JSON.parse(raw));
  } catch {
    return memoryFallback || [];
  }
}

function writeStored(records: FollowRecord[]): boolean {
  const payload = JSON.stringify(records);
  try {
    localStorage.setItem(STORAGE_KEY, payload);
    if (localStorage.getItem(STORAGE_KEY) === payload) {
      memoryFallback = null;
      return true;
    }
  } catch {
    /* fall through to memory fallback */
  }
  memoryFallback = records;
  return false;
}

function matches(e: FollowRecord, id?: string | null, name?: string): boolean {
  if (id && e.id && e.id === id) return true;
  if (name && e.name && e.name.toLowerCase() === name.toLowerCase()) return true;
  return false;
}

function toggleInternal(
  id?: string | null,
  name?: string
): { following: boolean; persisted: boolean } {
  if (!id && !name) return { following: false, persisted: true };
  const all = readStored();
  const index = all.findIndex((e) => matches(e, id, name));
  let updated: FollowRecord[];
  let following = false;
  if (index >= 0) {
    updated = all.filter((_, i) => i !== index);
  } else {
    updated = [...all, { id: id || undefined, name: name || '' }];
    following = true;
  }
  return { following, persisted: writeStored(updated) };
}

function isFollowingInternal(id?: string | null, name?: string): boolean {
  if (!id && !name) return false;
  return readStored().some((e) => matches(e, id, name));
}

// ---- legacy name-keyed API (FeedView, GroupRoomsView) ----
export function getFollowedAuthors(): string[] {
  return readStored().map((e) => e.name);
}

export function isFollowing(authorNameOrId: string): boolean {
  return isFollowingInternal(undefined, authorNameOrId);
}

export function toggleFollow(authorNameOrId: string): boolean {
  if (!authorNameOrId) return false;
  return toggleInternal(undefined, authorNameOrId).following;
}

// ---- id-keyed API with write verification (ProfileView) ----
export function isFollowingUser(id?: string | null, name?: string): boolean {
  return isFollowingInternal(id, name);
}

export function toggleFollowUser(
  id?: string | null,
  name?: string
): { following: boolean; persisted: boolean } {
  return toggleInternal(id, name);
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
  return readStored().length;
}
