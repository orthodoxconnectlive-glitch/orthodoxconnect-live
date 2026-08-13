import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Post } from '../types';
import { addNotification } from './notifications';

// Bunny Stream video links (Library ID: 713265)
export const BUNNY_STREAM_BASE = `https://${import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net'}`;
export const SEED_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
];

/**
 * Helper to convert Supabase row object to frontend Post model
 */
export function mapRowToPost(row: any): Post {
  const profile = row.profiles || row.profile;
  const authorName = profile?.full_name || profile?.fullName || row.author_name || row.authorName || 'Orthodox Member';
  const authorParish = profile?.parish || row.author_parish || row.authorParish || 'Parish Community';
  const authorAvatar = profile?.avatar_url || profile?.avatarUrl || row.author_avatar || row.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';

  const media = row.media_url || row.image_url || row.video_url || row.image || row.video;
  const isVideo = media?.includes('bunnynet') || media?.endsWith('.mp4') || media?.includes('videos-bucket');

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
    quotedPost: row.quoted_post ? mapRowToPost(row.quoted_post) : null,
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
    localStorage.setItem(SAVED_LOCAL_POSTS_KEY, JSON.stringify(updated.slice(0, 100)));
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

export async function loadPosts(
  groupId?: string,
  options?: { limit?: number; offset?: number }
): Promise<{ posts: Post[]; error: any }> {
  const localPosts = getLocalSavedPosts().filter((p) => !groupId || p.groupId === groupId);
  if (!isSupabaseConfigured) {
    return { posts: localPosts, error: null };
  }

  const limit = options?.limit ?? 25;
  const offset = options?.offset ?? 0;

  try {
    console.log('[Supabase] Fetching posts: SELECT * FROM posts ORDER BY created_at DESC');
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
      console.error('[Supabase loadPosts error]:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return { posts: localPosts, error };
    }

    if (data) {
      const dbPosts = data.map(mapRowToPost);
      const combined = [...dbPosts];
      localPosts.forEach((lp) => {
        if (!combined.some((p) => p.id === lp.id || (p.text === lp.text && p.createdAt === lp.createdAt))) {
          combined.push(lp);
        }
      });
      return { posts: combined, error: null };
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
      return data.map(mapRowToPost);
    }
  } catch (err) {
    console.warn('Author posts fetch notice:', err);
  }

  return localPosts;
}

export const DEFAULT_ORTHODOX_VIDEOS: Post[] = [
  {
    id: 'orthodox-reel-1',
    text: 'The Divine Liturgy & the Light of Christ at St. Anthony Monastery. Blessed Sunday everyone! #Orthodox #Christianity #Liturgy',
    authorName: 'Fr. Athanasios',
    authorParish: "St. Anthony's Monastery",
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    likesCount: 1420,
    commentsCount: 88,
    resharesCount: 312,
  },
];

export async function loadVideos(): Promise<Post[]> {
  const localReels = getLocalSavedPosts().filter((p) => !!p.video);
  if (!isSupabaseConfigured) {
    return localReels.length > 0 ? localReels : DEFAULT_ORTHODOX_VIDEOS;
  }

  try {
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .not('media_url', 'is', null)
      .order('created_at', { ascending: false });

    if (!postsError && postsData && postsData.length > 0) {
      return postsData.map(mapRowToPost).filter((p) => !!p.video);
    }
  } catch (err) {
    console.warn('Videos fetch notice:', err);
  }

  return localReels.length > 0 ? localReels : DEFAULT_ORTHODOX_VIDEOS;
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

  // Exact Supabase Database Payload Matching Table Schema
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
