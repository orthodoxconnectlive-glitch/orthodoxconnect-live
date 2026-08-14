import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Post } from '../types';
import { addNotification } from './notifications';

// Bunny Stream Credentials
export const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID || '713265';
export const BUNNY_API_KEY = import.meta.env.VITE_BUNNY_API_KEY || '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';
export const BUNNY_CDN_HOSTNAME = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';
export const BUNNY_STREAM_BASE = `https://${BUNNY_CDN_HOSTNAME}`;

// Guaranteed Seed Posts so feed is never empty
export const INITIAL_SEED_POSTS: Post[] = [
  {
    id: 'seed-post-1',
    text: '"I come to You" — English-Coptic Spiritual Song and reflection on the Holy Liturgy ☨',
    authorName: 'LUCASAUTOCODE',
    authorParish: 'Orthodox Church',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
    createdAt: new Date().toISOString(),
    likesCount: 12,
    commentsCount: 3,
    resharesCount: 1,
  },
  {
    id: 'seed-post-2',
    text: 'Grace and peace from St. George Parish Community. May the Lord strengthen everyone today in prayer and fellowship.',
    authorName: 'Fr. Athanasios',
    authorParish: 'St. George Cathedral',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    image: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=800',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    likesCount: 24,
    commentsCount: 5,
    resharesCount: 2,
  },
];

/**
 * Helper to convert Supabase row object to frontend Post model
 */
export function mapRowToPost(row: any, profileMap?: Record<string, any>): Post {
  const profile = profileMap?.[row.user_id] || row.profiles || row.profile;
  const authorName = profile?.full_name || profile?.fullName || row.author_name || row.authorName || 'Orthodox Member';
  const authorParish = profile?.parish || row.author_parish || row.authorParish || 'Parish Community';
  const authorAvatar = profile?.avatar_url || profile?.avatarUrl || row.author_avatar || row.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';

  const rawMedia = row.media_url || row.video_url || row.image_url || row.image || row.video || '';
  const isVideo =
    rawMedia.includes('bunnynet') ||
    rawMedia.includes('mediadelivery.net') ||
    rawMedia.includes('b-cdn.net') ||
    rawMedia.includes('googleapis.com') ||
    rawMedia.endsWith('.mp4') ||
    rawMedia.endsWith('.mov') ||
    rawMedia.endsWith('.webm');

  return {
    id: String(row.id),
    text: row.content || row.text || '',
    authorName,
    authorParish,
    authorAvatar,
    authorId: row.user_id || row.author_id || row.authorId || profile?.id,
    image: isVideo ? undefined : (rawMedia || undefined),
    video: isVideo ? rawMedia : undefined,
    audio: row.audio_url || row.audio || row.audioUrl || undefined,
    audioUrl: row.audio_url || row.audio || row.audioUrl || undefined,
    broadcastUrl: row.broadcast_url || row.broadcastUrl || undefined,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    groupId: row.group_id || row.groupId || undefined,
    likesCount: row.likes_count ?? row.likesCount ?? 0,
    commentsCount: row.comments_count ?? row.commentsCount ?? 0,
    resharesCount: row.reshares_count ?? row.resharesCount ?? 0,
    isLiked: row.is_liked ?? false,
    isReshared: row.is_reshared ?? false,
    quotedPost: row.quoted_post ? mapRowToPost(row.quoted_post, profileMap) : null,
    reshareKind: row.reshare_kind || undefined,
  };
}

const SAVED_COMMENTS_KEY = 'orthodox_local_comments_v2';
const SAVED_LIKES_KEY = 'orthodox_local_likes_v2';
const SAVED_LOCAL_POSTS_KEY = 'orthodox_local_saved_posts_v1';

export function loadLocalPostCommentsMap(): Record<string, string[]> {
  try {
    const saved = localStorage.getItem(SAVED_COMMENTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error loading local comments map:', e);
  }
  return {};
}

export function saveLocalPostCommentsMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(SAVED_COMMENTS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Error saving local comments map:', e);
  }
}

export function loadLocalLikesMap(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(SAVED_LIKES_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error loading likes map:', e);
  }
  return {};
}

export function saveLocalLikesMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(SAVED_LIKES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Error saving likes map:', e);
  }
}

export function getLocalSavedPosts(): Post[] {
  try {
    const raw = localStorage.getItem(SAVED_LOCAL_POSTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading local saved posts:', e);
  }
  return INITIAL_SEED_POSTS;
}

export function saveLocalPostToCache(post: Post) {
  try {
    const existing = getLocalSavedPosts();
    const filtered = existing.filter(
      (p) => p.id !== post.id && !(p.text === post.text && p.createdAt === post.createdAt)
    );
    const updated = [post, ...filtered];
    localStorage.setItem(SAVED_LOCAL_POSTS_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch (e) {
    console.warn('[Post Cache] Error saving local post to cache:', e);
  }
}

/**
 * Load Main Posts Feed
 */
export async function loadPosts(
  groupId?: string,
  options?: { limit?: number; offset?: number }
): Promise<{ posts: Post[]; error: any }> {
  const localPosts = getLocalSavedPosts().filter((p) => !groupId || p.groupId === groupId);

  if (!isSupabaseConfigured) {
    return { posts: localPosts, error: null };
  }

  const limit = options?.limit ?? 15;
  const offset = options?.offset ?? 0;

  try {
    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return { posts: localPosts, error: error || null };
    }

    const userIds = Array.from(new Set(data.map((p) => p.user_id).filter(Boolean)));
    let profileMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, parish, avatar_url')
        .in('id', userIds);

      if (profiles) {
        profiles.forEach((prof) => {
          profileMap[prof.id] = prof;
        });
      }
    }

    const dbPosts = data.map((row) => mapRowToPost(row, profileMap));
    
    const merged = [...dbPosts];
    localPosts.forEach((lp) => {
      if (!merged.some((p) => p.id === lp.id)) merged.push(lp);
    });

    return { posts: merged, error: null };
  } catch (err: any) {
    return { posts: localPosts, error: err };
  }
}

export async function loadPostsByAuthor(authorId: string): Promise<Post[]> {
  const localPosts = getLocalSavedPosts().filter(
    (p) => p.authorId === authorId || p.authorName.toLowerCase().includes(authorId.toLowerCase())
  );
  if (!isSupabaseConfigured) return localPosts;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authorId);
    let query = supabase.from('posts').select('*');

    if (isUuid) {
      query = query.eq('user_id', authorId);
    } else {
      query = query.ilike('author_name', `%${authorId}%`);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data && data.length > 0) {
      return data.map((row) => mapRowToPost(row));
    }
  } catch (err) {}

  return localPosts;
}

/**
 * Load Vertical Videos Feed
 */
export async function loadVideos(): Promise<Post[]> {
  const sampleVideos: Post[] = [
    {
      id: 'v-101',
      text: 'Orthodox Spiritual Reflection & Liturgical Song ☨',
      authorName: 'OrthodoxConnect',
      authorParish: 'Parish Fellowship',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
      createdAt: new Date().toISOString(),
      likesCount: 25,
      commentsCount: 2,
      resharesCount: 0,
    },
    {
      id: 'v-102',
      text: '"I Come to You" — English-Coptic Spiritual Song',
      authorName: 'Fr. Athanasios',
      authorParish: 'St. George Cathedral',
      authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
      createdAt: new Date().toISOString(),
      likesCount: 42,
      commentsCount: 5,
      resharesCount: 1,
    },
  ];

  const localPosts = getLocalSavedPosts();
  const localReels = localPosts.filter((p) => !!p.video);

  const combined = [...sampleVideos];
  localReels.forEach((lp) => {
    if (!combined.some((v) => v.id === lp.id || (v.text === lp.text && v.createdAt === lp.createdAt))) {
      combined.unshift(lp);
    }
  });

  return combined;
}

export const loadReels = loadVideos;

export async function savePost(postPartial: Partial<Post>): Promise<Post> {
  const isUuid =
    postPartial.authorId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postPartial.authorId);

  const newPost: Post = {
    id: postPartial.id || 'post-' + Date.now(),
    text: postPartial.text || '',
    authorName: postPartial.authorName || 'Orthodox Visitor',
    authorParish: postPartial.authorParish || 'Parish Community',
    authorAvatar: postPartial.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    authorId: postPartial.authorId,
    image: postPartial.image,
    video: postPartial.video,
    createdAt: postPartial.createdAt || new Date().toISOString(),
    groupId: postPartial.groupId,
    likesCount: postPartial.likesCount || 0,
    commentsCount: postPartial.commentsCount || 0,
    resharesCount: postPartial.resharesCount || 0,
    quotedPost: postPartial.quotedPost,
    reshareKind: postPartial.reshareKind,
  };

  saveLocalPostToCache(newPost);

  if (!isSupabaseConfigured) {
    return newPost;
  }

  const dbPayload: Record<string, any> = {
    content: newPost.text,
    user_id: isUuid ? newPost.authorId : null,
    media_url: newPost.image || newPost.video || null,
    created_at: newPost.createdAt,
  };

  try {
    const { data, error } = await supabase.from('posts').insert([dbPayload]).select();

    if (!error && data && data.length > 0) {
      const saved = mapRowToPost(data[0]);
      saved.authorName = newPost.authorName;
      saved.authorAvatar = newPost.authorAvatar;
      saved.authorParish = newPost.authorParish;
      saveLocalPostToCache(saved);

      addNotification({
        userId: 'all',
        type: 'mention',
        title: `New Post from ${saved.authorName}`,
        body: saved.text ? (saved.text.length > 80 ? saved.text.slice(0, 80) + '...' : saved.text) : 'Shared a new reflection.',
        senderName: saved.authorName,
        senderAvatar: saved.authorAvatar,
        link: 'feed',
      });

      return saved;
    }
  } catch (err) {}

  return newPost;
}

export async function loadPost(postId: string): Promise<Post | null> {
  const localFound = getLocalSavedPosts().find((p) => p.id === postId);
  if (localFound) return localFound;

  if (!isSupabaseConfigured) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
    if (!isUuid) return null;

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (!error && data) {
      return mapRowToPost(data);
    }
  } catch (err) {}

  return null;
}

export async function deletePost(postId: string): Promise<boolean> {
  try {
    const existing = getLocalSavedPosts().filter((p) => p.id !== postId);
    localStorage.setItem(SAVED_LOCAL_POSTS_KEY, JSON.stringify(existing));

    if (isSupabaseConfigured && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
      await supabase.from('posts').delete().eq('id', postId);
    }
  } catch (e) {}

  return true;
}

export async function createReshare(
  postId: string,
  kind: 'reshare' | 'quote',
  quote?: string
): Promise<Post> {
  const originalPost = await loadPost(postId);

  if (originalPost) {
    originalPost.resharesCount = (originalPost.resharesCount || 0) + 1;
  }

  const resharePost: Post = {
    id: 'reshare-' + Date.now(),
    text: quote || (kind === 'reshare' ? `Reshared from ${originalPost?.authorName || 'Parishioner'}` : ''),
    authorName: 'Orthodox Member',
    authorParish: 'St. George Cathedral',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    createdAt: new Date().toISOString(),
    quotedPost: originalPost,
    reshareKind: kind,
    likesCount: 0,
    commentsCount: 0,
    resharesCount: 0,
  };

  return await savePost(resharePost);
}
