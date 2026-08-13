import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Post } from '../types';
import { addNotification } from './notifications';

// Bunny Stream Credentials
export const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID || '713265';
export const BUNNY_API_KEY = import.meta.env.VITE_BUNNY_API_KEY || '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';
export const BUNNY_CDN_HOSTNAME = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';
export const BUNNY_STREAM_BASE = `https://${BUNNY_CDN_HOSTNAME}`;

/**
 * Helper to convert Supabase row object to frontend Post model
 */
export function mapRowToPost(row: any, profileMap?: Record<string, any>): Post {
  const profile = profileMap?.[row.user_id] || row.profiles || row.profile;
  const authorName = profile?.full_name || profile?.fullName || row.author_name || row.authorName || 'Orthodox Member';
  const authorParish = profile?.parish || row.author_parish || row.authorParish || 'Parish Community';
  const authorAvatar = profile?.avatar_url || profile?.avatarUrl || row.author_avatar || row.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';

  const media = row.media_url || row.image_url || row.video_url || row.image || row.video;
  const isVideo = media?.includes('bunnynet') || media?.includes('mediadelivery.net') || media?.includes('b-cdn.net') || media?.endsWith('.mp4');

  return {
    id: String(row.id),
    text: row.content || row.text || '',
    authorName,
    authorParish,
    authorAvatar,
    authorId: row.user_id || row.author_id || row.authorId || profile?.id,
    image: isVideo ? undefined : media,
    video: isVideo ? media : undefined,
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
const SAVED_REEL_COMMENTS_KEY = 'orthodox_local_reel_comments_v2';
const SAVED_LIKES_KEY = 'orthodox_local_likes_v2';

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

export function loadLocalReelCommentsMap(): Record<string, any[]> {
  try {
    const saved = localStorage.getItem(SAVED_REEL_COMMENTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error loading reel comments map:', e);
  }
  return {};
}

export function saveLocalReelCommentsMap(map: Record<string, any[]>) {
  try {
    localStorage.setItem(SAVED_REEL_COMMENTS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Error saving reel comments map:', e);
  }
}

const SAVED_LOCAL_POSTS_KEY = 'orthodox_local_saved_posts_v1';

export function getLocalSavedPosts(): Post[] {
  try {
    const raw = localStorage.getItem(SAVED_LOCAL_POSTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local saved posts:', e);
  }
  return [];
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

/**
 * Fast Load Posts Function using direct table query and batch profiles
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

    if (error) {
      console.error('[Supabase loadPosts error]:', error.message);
      return { posts: localPosts, error };
    }

    if (data && data.length > 0) {
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
      return { posts: dbPosts, error: null };
    }
  } catch (err: any) {
    console.error('[Supabase loadPosts exception]:', err?.message || err);
    return { posts: localPosts, error: err };
  }

  return { posts: localPosts, error: null };
}

export async function loadPostsByAuthor(authorId: string): Promise<Post[]> {
  const localPosts = getLocalSavedPosts().filter(
    (p) => p.authorId === authorId || p.authorName.toLowerCase().includes(authorId.toLowerCase())
  );
  if (!isSupabaseConfigured) {
    return localPosts;
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authorId);
    let query = supabase.from('posts').select('*');

    if (isUuid) {
      query = query.eq('user_id', authorId);
    } else {
      query = query.ilike('author_name', `%${authorId}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.warn('Author posts fetch notice:', error.message || error);
      return localPosts;
    }

    if (data) {
      return data.map((row) => mapRowToPost(row));
    }
  } catch (err) {
    console.warn('Author posts fetch notice:', err);
  }

  return localPosts;
}

/**
 * Fetches videos directly from Bunny Stream REST API Library
 */
export async function loadVideos(): Promise<Post[]> {
  try {
    const res = await fetch(
      `https://video.mediadelivery.net/library/${BUNNY_LIBRARY_ID}/videos?page=1&itemsPerPage=50&orderBy=date`,
      {
        method: 'GET',
        headers: {
          AccessKey: BUNNY_API_KEY,
          accept: 'application/json',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];

      if (items.length > 0) {
        return items.map((video: any) => ({
          id: video.guid,
          text: video.title ? video.title.replace('.mp4', '') : 'Orthodox Reflection Video',
          authorName: 'OrthodoxConnect',
          authorParish: 'Parish Fellowship',
          authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
          video: `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${video.guid}`,
          image: `https://${BUNNY_CDN_HOSTNAME}/${video.guid}/thumbnail.jpg`,
          createdAt: video.dateUploaded || new Date().toISOString(),
          likesCount: video.views || 0,
          commentsCount: 0,
          resharesCount: 0,
        }));
      }
    }
  } catch (err) {
    console.warn('Bunny Stream API fetch error:', err);
  }

  const localPosts = getLocalSavedPosts();
  const localReels = localPosts.filter((p) => !!p.video);
  return localReels;
}

export const loadReels = loadVideos;

/**
 * Inserts a post directly into Supabase adhering strictly to database schema
 */
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
    console.log('[Supabase] Executing direct database insert into "posts":', dbPayload);
    const { data, error } = await supabase.from('posts').insert([dbPayload]).select();

    if (error) {
      console.error('[Supabase Post Insert Error]:', error);
    } else if (data && data.length > 0) {
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
  } catch (err: any) {
    console.error('[Supabase Post Insert Exception]:', err?.message || err);
  }

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
  } catch (err) {
    console.warn('Load single post notice:', err);
  }

  return null;
}

export async function deletePost(postId: string): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
    if (!isUuid || !isSupabaseConfigured) return true;

    const { error: postsErr } = await supabase.from('posts').delete().eq('id', postId);
    if (postsErr) console.warn('Delete post note:', postsErr.message || postsErr);
  } catch (err) {
    console.warn('Delete post notice:', err);
  }

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
