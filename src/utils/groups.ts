import { GroupRoom } from '../types';
import { fetchServerGroups, createServerGroup, updateServerGroup } from '../lib/api';

const GROUPS_STORAGE_KEY = 'orthodoxconnect_joined_groups';
const CUSTOM_GROUPS_KEY = 'orthodoxconnect_custom_groups_v1';

const DEFAULT_JOINED_GROUPS = ['room-bible', 'room-choir', 'room-youth'];

export function getJoinedGroupIds(): string[] {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(DEFAULT_JOINED_GROUPS));
      return DEFAULT_JOINED_GROUPS;
    }
    return JSON.parse(raw) as string[];
  } catch {
    return DEFAULT_JOINED_GROUPS;
  }
}

export function isGroupJoined(groupId: string): boolean {
  if (!groupId) return false;
  const joined = getJoinedGroupIds();
  return joined.includes(groupId);
}

export function toggleGroupJoin(groupId: string): boolean {
  if (!groupId) return false;
  const joined = getJoinedGroupIds();
  const index = joined.indexOf(groupId);

  let updated: string[];
  let isNowJoined = false;

  if (index >= 0) {
    updated = joined.filter((id) => id !== groupId);
    isNowJoined = false;
  } else {
    updated = [...joined, groupId];
    isNowJoined = true;
  }

  try {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('LocalStorage group join failed:', err);
  }

  return isNowJoined;
}

export function getCustomGroups(): GroupRoom[] {
  try {
    const raw = localStorage.getItem(CUSTOM_GROUPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading custom groups:', e);
  }
  return [];
}

function writeCustomGroups(groups: GroupRoom[]): void {
  try {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(groups));
  } catch (e) {
    console.warn('Error saving custom groups:', e);
  }
}

function autoJoinGroup(groupId: string): void {
  try {
    const joined = getJoinedGroupIds();
    if (!joined.includes(groupId)) {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify([...joined, groupId]));
    }
  } catch (e) {
    console.warn('LocalStorage group join failed:', e);
  }
}

/** Map a D1 custom_groups row (snake_case) to the client GroupRoom shape. */
export function mapServerGroup(row: any): GroupRoom {
  return {
    id: String(row.id || ''),
    name: String(row.name || row.name_ar || row.name_en || ''),
    name_ar: row.name_ar || '',
    name_en: row.name_en || '',
    type: (row.type || 'general') as GroupRoom['type'],
    description: String(row.description || row.description_ar || row.description_en || ''),
    description_ar: row.description_ar || '',
    description_en: row.description_en || '',
    activeCount: typeof row.active_count === 'number' ? row.active_count : 1,
    membersCount: typeof row.active_count === 'number' ? row.active_count : 1,
    icon: row.icon || '✨',
    hostName: row.host_name || '',
    host_id: row.host_id || '',
    parish: row.parish || '',
    creator_id: row.creator_id || '',
    isUserCreated: true,
    created_at: row.created_at || '',
  };
}

function serverPayload(g: Partial<GroupRoom> & { id?: string }): any {
  return {
    id: g.id,
    name: g.name,
    name_ar: g.name_ar || '',
    name_en: g.name_en || '',
    description: g.description,
    description_ar: g.description_ar || '',
    description_en: g.description_en || '',
    type: g.type,
    icon: g.icon,
    parish: g.parish,
    host_name: g.hostName,
  };
}

export async function createCustomGroup(groupData: Omit<GroupRoom, 'id' | 'activeCount'>): Promise<GroupRoom> {
  const localGroup: GroupRoom = {
    ...groupData,
    id: 'group-custom-' + Date.now(),
    activeCount: 1,
    membersCount: 1,
    isUserCreated: true,
  };

  // Try the server first so the group is visible to every account.
  let finalGroup = localGroup;
  try {
    const row = await createServerGroup(serverPayload(localGroup));
    if (row) finalGroup = mapServerGroup(row);
  } catch (e) {
    console.warn('Server group create failed, keeping local-only:', e);
  }

  const existing = getCustomGroups().filter((g) => g.id !== finalGroup.id);
  writeCustomGroups([finalGroup, ...existing]);
  autoJoinGroup(finalGroup.id);

  return finalGroup;
}

/**
 * Pull server groups into the local cache, then push any local-only
 * custom groups up (idempotent — the server uses INSERT OR REPLACE).
 * Server rows win on conflict. Returns the merged list.
 */
export async function syncGroupsFromServer(): Promise<GroupRoom[]> {
  let serverRows: any[] = [];
  try {
    serverRows = await fetchServerGroups();
  } catch (e) {
    console.warn('Server groups fetch failed:', e);
    return getCustomGroups();
  }
  const serverGroups = (serverRows || []).map(mapServerGroup);
  const serverIds = new Set(serverGroups.map((g) => g.id));

  // Push local-only custom groups up so they become visible to other accounts.
  const localOnly = getCustomGroups().filter(
    (g) => g.id.startsWith('group-custom-') && !serverIds.has(g.id)
  );
  for (const g of localOnly) {
    try {
      const row = await createServerGroup(serverPayload(g));
      if (row) serverIds.add(String(row.id || g.id));
    } catch (e) {
      // Offline or signed out — stays local-only for now.
    }
  }

  // Merge: server wins, then any remaining local-only groups.
  const merged = [...serverGroups];
  for (const g of getCustomGroups()) {
    if (!serverIds.has(g.id) && !merged.some((m) => m.id === g.id)) merged.push(g);
  }
  writeCustomGroups(merged);
  return merged;
}

/** Update a server-backed group, then mirror the result into the local cache. */
export async function updateServerBackedGroup(
  groupId: string,
  patch: Partial<GroupRoom>
): Promise<GroupRoom | null> {
  let updated: GroupRoom | null = null;
  try {
    const row = await updateServerGroup(groupId, serverPayload(patch));
    if (row) updated = mapServerGroup(row);
  } catch (e) {
    console.warn('Server group update failed:', e);
  }
  if (updated) {
    writeCustomGroups(getCustomGroups().map((g) => (g.id === groupId ? { ...g, ...updated } : g)));
  }
  return updated;
}

export function updateGroupMetadata(groupId: string, patch: Partial<GroupRoom>): void {
  const existing = getCustomGroups();
  const updated = existing.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
  writeCustomGroups(updated);
}
