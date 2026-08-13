import { GroupRoom } from '../types';

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

export function createCustomGroup(groupData: Omit<GroupRoom, 'id' | 'activeCount'>): GroupRoom {
  const newGroup: GroupRoom = {
    ...groupData,
    id: 'group-custom-' + Date.now(),
    activeCount: 1,
    membersCount: 1,
    isUserCreated: true,
  };

  const existing = getCustomGroups();
  const updated = [newGroup, ...existing];

  try {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(updated));
    // Auto-join creator to new group
    const joined = getJoinedGroupIds();
    if (!joined.includes(newGroup.id)) {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify([...joined, newGroup.id]));
    }
  } catch (e) {
    console.warn('Error saving custom group:', e);
  }

  return newGroup;
}

export function updateGroupMetadata(groupId: string, patch: Partial<GroupRoom>): void {
  const existing = getCustomGroups();
  const updated = existing.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
  try {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error updating group metadata:', e);
  }
}

