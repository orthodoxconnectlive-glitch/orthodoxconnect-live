import { apiFetch } from '../lib/api';

export type ReactionTargetType = 'post' | 'book' | 'story' | 'comment';

// The six blessed reactions. ❤️ is the canonical "Bless".
export const REACTION_EMOJIS = ['❤️', '🙏', '🕊️', '😮', '😢', '👏'];
export const REACTION_HEART = '❤️';

export const REACTION_LABELS: Record<string, { en: string; ar: string }> = {
  '❤️': { en: 'Blessed', ar: 'مُبارك' },
  '🙏': { en: 'Amen', ar: 'آمين' },
  '🕊️': { en: 'Peace', ar: 'سلام' },
  '😮': { en: 'Wow', ar: 'مدهش' },
  '😢': { en: 'Sad', ar: 'حزين' },
  '👏': { en: 'Bravo', ar: 'أحسنت' },
};

export function reactionLabel(emoji: string, language: string): string {
  const l = REACTION_LABELS[emoji];
  if (!l) return emoji;
  return language === 'ar' ? l.ar : l.en;
}

export function totalReactions(counts: Record<string, number> | undefined | null): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((a, n) => a + (Number(n) || 0), 0);
}

export function topEmojis(
  counts: Record<string, number> | undefined | null,
  n = 3
): string[] {
  if (!counts) return [];
  return Object.entries(counts)
    .filter(([, v]) => (Number(v) || 0) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, n)
    .map(([e]) => e);
}

function actorFields(profile: any) {
  return {
    author_name: profile?.full_name || profile?.name || undefined,
    author_avatar: profile?.avatar_url || profile?.avatar || undefined,
  };
}

export async function setReaction(
  targetType: ReactionTargetType,
  targetId: string,
  emoji: string,
  profile?: any
): Promise<{ success: boolean; counts?: Record<string, number>; total?: number; my_emoji?: string | null }> {
  const data = await apiFetch('/api/reactions', {
    method: 'POST',
    body: JSON.stringify({
      target_type: targetType,
      target_id: targetId,
      emoji,
      ...actorFields(profile),
    }),
  });
  return data;
}

export async function removeReaction(
  targetType: ReactionTargetType,
  targetId: string
): Promise<{ success: boolean; counts?: Record<string, number>; total?: number; my_emoji?: string | null }> {
  const data = await apiFetch('/api/reactions', {
    method: 'DELETE',
    body: JSON.stringify({ target_type: targetType, target_id: targetId }),
  });
  return data;
}

export async function fetchReactors(
  targetType: ReactionTargetType,
  targetId: string
): Promise<{
  success: boolean;
  reactors?: { userId: string; userName: string; userAvatar?: string; emoji: string }[];
  counts?: Record<string, number>;
  total?: number;
}> {
  const data = await apiFetch(
    `/api/reactions?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`
  );
  return data;
}
