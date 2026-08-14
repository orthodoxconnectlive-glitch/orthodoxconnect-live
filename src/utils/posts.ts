import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Post } from '../types';
import { addNotification } from './notifications';

// Bunny Stream video links (Library ID: 713265)
export const BUNNY_STREAM_BASE = `https://${import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net'}`;
export const SEED_VIDEOS: string[] = [];

// Helper to convert Supabase row object to frontend Post model
export function mapRowToPost(row: any): Post {
  const profile = row.profiles || row.profile;
  const authorName = profile?.full_name || profile?.fullName || row.author_name || row.authorName || 'Orthodox Member';
  const authorParish = profile?.parish || row.author_parish || row.authorParish || 'Parish Community';
  const authorAvatar = profile?.avatar_url || profile?.avatarUrl || row.author_avatar || row.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';

  return {
    id: String(row.id),
    text: row.content || row.text || '',
    authorName,
    authorParish,
    authorAvatar,
    authorId: row.author_id || row.authorId || profile?.id,
    image: row.image_url || row.image || undefined,
    video: row.video_url || row.video || undefined,
    audio: row.audio_url || row.audio || row.audioUrl || undefined,
    audioUrl: row.audio_url || row.audio || row.audioUrl || undefined,
    broadcastUrl: row.broadcast_url || row.broadcastUrl || undefined,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    groupId: row.group_id || row.groupId || undefined,
    likesCount: row.likes_count ?? row.likesCount ?? 0,
    commentsCount: row.comments_count ?? row.commentsCount ?? 0,
    resharesCount: row.reshares_count ?? row.resharesCount ?? 0,
    isLiked: Boolean(row.is_liked),
    isReshared: Boolean(row.is_reshared),
    quotedPost: row.quoted_post ? mapRowToPost(row.quoted_post) : null,
    reshareKind: row.reshare_kind || undefined,
  };
}

const SAVED_COMMENTS_KEY = 'orthodox_local_comments_v3';
const SAVED_REEL_COMMENTS_KEY = 'orthodox_local_reel_comments_v3';
const SAVED_LIKES_KEY = 'orthodox_local_likes_v3';
const SAVED_LOCAL_POSTS_KEY = 'orthodox_local_saved_posts_v3';

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

// Clean empty default (no fake AI posts)
export const DEFAULT_COMMUNITY_POSTS: Post[] = [];

// Helper to sanitize post object for strictly serializable plain fields
export function sanitizePost(post: any): Post {
  if (!post || typeof post !== 'object') {
    return {
      id: 'post-' + Date.now(),
      text: '',
      authorName: 'Orthodox Member',
      authorParish: 'Parish Community',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      createdAt: new Date().toISOString(),
    };
  }

  const cleanString = (val: any) => (typeof val === 'string' ? val : typeof val === 'number' ? String(val) : undefined);

  return {
    id: cleanString(post.id) || 'post-' + Date.now(),
    text: typeof post.text === 'string' ? post.text : typeof post.content === 'string' ? post.content : '',
    authorName: cleanString(post.authorName) || cleanString(post.author_name) || 'Orthodox Member',
    authorParish: cleanString(post.authorParish) || cleanString(post.author_parish) || 'Parish Community',
    authorAvatar:
      cleanString(post.authorAvatar) ||
      cleanString(post.author_avatar) ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    authorId: cleanString(post.authorId) || cleanString(post.author_id),
    image: cleanString(post.image) || cleanString(post.image_url),
    video: cleanString(post.video) || cleanString(post.video_url),
    audio: cleanString(post.audio) || cleanString(post.audioUrl) || cleanString(post.audio_url),
    audioUrl: cleanString(post.audioUrl) || cleanString(post.audio) || cleanString(post.audio_url),
    broadcastUrl: cleanString(post.broadcastUrl) || cleanString(post.broadcast_url),
    createdAt: cleanString(post.createdAt) || cleanString(post.created_at) || new Date().toISOString(),
    groupId: cleanString(post.groupId) || cleanString(post.group_id),
    likesCount: typeof post.likesCount === 'number' ? post.likesCount : typeof post.likes_count === 'number' ? post.likes_count : 0,
    commentsCount: typeof post.commentsCount === 'number' ? post.commentsCount : typeof post.comments_count === 'number' ? post.comments_count : 0,
    resharesCount: typeof post.resharesCount === 'number' ? post.resharesCount : typeof post.reshares_count === 'number' ? post.reshares_count : 0,
    isLiked: Boolean(post.isLiked ?? post.is_liked),
    isReshared: Boolean(post.isReshared ?? post.is_reshared),
    quotedPost: post.quotedPost && typeof post.quotedPost === 'object' && post.quotedPost !== post ? sanitizePost(post.quotedPost) : null,
    reshareKind: post.reshareKind === 'quote' || post.reshareKind === 'reshare' ? post.reshareKind : undefined,
  };
}

export function getLocalSavedPosts(): Post[] {
  try {
    const raw = localStorage.getItem(SAVED_LOCAL_POSTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((p) => p && !String(p.id).startsWith('orthodox-post-seed') && !String(p.id).startsWith('orthodox-reel-'))
          .map(sanitizePost);
      }
    }
  } catch (e: any) {
    console.warn('Error reading local saved posts:', e?.message || String(e));
  }
  return [];
}

export function saveLocalPostToCache(post: Post) {
  try {
    const cleanPost = sanitizePost(post);
    const existing = getLocalSavedPosts();
    // Filter out duplicates by id or exact match
    const filtered = existing.filter(
      (p) => p.id !== cleanPost.id && !(p.text === cleanPost.text && p.createdAt === cleanPost.createdAt)
    );
    const updated = [cleanPost, ...filtered];
    localStorage.setItem(SAVED_LOCAL_POSTS_KEY, JSON.stringify(updated.slice(0, 100)));
  } catch (e: any) {
    console.warn('[Post Cache] Error saving local post to cache:', e?.message || String(e));
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

// In-memory cache for ultra fast queries and smooth navigation
let cachedPosts: { data: Post[]; timestamp: number; groupId?: string } | null = null;
const CACHE_TTL_MS = 12000;

export function invalidatePostsCache() {
  cachedPosts = null;
}

export async function loadPosts(
  groupId?: string,
  options?: { limit?: number; offset?: number; forceRefresh?: boolean }
): Promise<{ posts: Post[]; error: any }> {
  const localPosts = getLocalSavedPosts().filter((p) => !groupId || p.groupId === groupId);

  if (!options?.forceRefresh && cachedPosts && cachedPosts.groupId === groupId && Date.now() - cachedPosts.timestamp < CACHE_TTL_MS) {
    return { posts: cachedPosts.data, error: null };
  }

  if (!isSupabaseConfigured) {
    return { posts: localPosts, error: null };
  }

  const limit = options?.limit ?? 30;
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

    const timer = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('QUERY_TIMEOUT')), 3500));
    const { data, error } = await Promise.race([query, timer]).catch(() => ({ data: null, error: null }));

    if (error) {
      console.warn('[Supabase loadPosts notice]:', error.message || error);
      return { posts: localPosts, error: null };
    }

    if (data && Array.isArray(data)) {
      const dbPosts = data.map(mapRowToPost);
      // Cache in memory for instant switching
      cachedPosts = { data: dbPosts, timestamp: Date.now(), groupId };
      return { posts: dbPosts, error: null };
    }
  } catch (err: any) {
    console.warn('[Supabase loadPosts caught notice]:', err?.message || err);
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
      query = query.or(`author_id.eq.${authorId},author_name.ilike.%${authorId}%`);
    } else {
      query = query.ilike('author_name', `%${authorId}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(30);

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

export const DEFAULT_ORTHODOX_VIDEOS: Post[] = [];

export async function loadVideos(): Promise<Post[]> {
  const localReels = getLocalSavedPosts().filter((p) => !!p.video);
  if (!isSupabaseConfigured) {
    return localReels;
  }

  try {
    const timer = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('VIDEOS_TIMEOUT')), 3000));
    const reelsPromise = supabase
      .from('posts_reels')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: reelsData, error: reelsError } = await Promise.race([reelsPromise, timer]).catch(() => ({ data: null, error: null }));

    if (!reelsError && reelsData && reelsData.length > 0) {
      return reelsData.map(mapRowToPost);
    }

    const postsPromise = supabase
      .from('posts')
      .select('*')
      .or('video.not.is.null,video_url.not.is.null')
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: postsData, error: postsError } = await Promise.race([postsPromise, timer]).catch(() => ({ data: null, error: null }));

    if (!postsError && postsData && postsData.length > 0) {
      return postsData.map(mapRowToPost);
    }
  } catch (err) {
    console.warn('Videos fetch notice:', err);
  }

  return localReels;
}

export const loadReels = loadVideos;

export async function savePost(postPartial: Partial<Post>): Promise<Post> {
  const isUuid =
    postPartial.authorId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postPartial.authorId);

  const newPost: Post = {
    id: postPartial.id || 'post-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    text: postPartial.text || '',
    authorName: postPartial.authorName || 'Orthodox Member',
    authorParish: postPartial.authorParish || 'Parish Community',
    authorAvatar:
      postPartial.authorAvatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    authorId: postPartial.authorId,
    image: postPartial.image,
    video: postPartial.video,
    audio: postPartial.audio || postPartial.audioUrl,
    audioUrl: postPartial.audioUrl || postPartial.audio,
    broadcastUrl: postPartial.broadcastUrl,
    createdAt: postPartial.createdAt || new Date().toISOString(),
    groupId: postPartial.groupId,
    likesCount: postPartial.likesCount || 0,
    commentsCount: postPartial.commentsCount || 0,
    resharesCount: postPartial.resharesCount || 0,
    quotedPost: postPartial.quotedPost,
    reshareKind: postPartial.reshareKind,
  };

  // Cache locally immediately for optimistic UI & offline resilience
  saveLocalPostToCache(newPost);
  invalidatePostsCache();

  if (!isSupabaseConfigured) {
    return newPost;
  }

  const dbPayload: Record<string, any> = {
    content: newPost.text,
    author_name: newPost.authorName,
    author_parish: newPost.authorParish,
    author_avatar: newPost.authorAvatar,
    author_id: isUuid ? newPost.authorId : null,
    image_url: newPost.image || null,
    video: newPost.video || null,
    video_url: newPost.video || null,
    group_id: newPost.groupId || null,
    created_at: newPost.createdAt,
  };

  if (newPost.video) {
    try {
      await supabase.from('posts_reels').insert([{
        content: newPost.text,
        author_name: newPost.authorName,
        author_parish: newPost.authorParish,
        author_avatar: newPost.authorAvatar,
        author_id: isUuid ? newPost.authorId : null,
        video_url: newPost.video,
        created_at: newPost.createdAt,
      }]);
    } catch (reelsErr: any) {
      console.warn('posts_reels insert notice:', reelsErr?.message || reelsErr);
    }
  }

  try {
    const { data, error } = await supabase.from('posts').insert([dbPayload]).select();

    if (error) {
      console.warn('[Supabase Post Insert Note]:', error.message);
      // Fallback for strict column schemas
      if (error.code === '42703' || error.message?.includes('column')) {
        const fallbackPayload: Record<string, any> = {
          content: newPost.text,
          image_url: newPost.image || null,
          video_url: newPost.video || null,
          created_at: newPost.createdAt,
        };
        if (isUuid) fallbackPayload.author_id = newPost.authorId;

        const { data: fbData } = await supabase.from('posts').insert([fallbackPayload]).select();
        if (fbData && fbData.length > 0) {
          const savedFallback = mapRowToPost(fbData[0]);
          if (!savedFallback.image && newPost.image) savedFallback.image = newPost.image;
          if (!savedFallback.video && newPost.video) savedFallback.video = newPost.video;
          saveLocalPostToCache(savedFallback);
          return savedFallback;
        }
      }
    } else if (data && data.length > 0) {
      const saved = mapRowToPost(data[0]);
      if (!saved.image && newPost.image) saved.image = newPost.image;
      if (!saved.video && newPost.video) saved.video = newPost.video;

      saveLocalPostToCache(saved);
      return saved;
    }
  } catch (err: any) {
    console.warn('[Supabase Post Insert caught note]:', err?.message || err);
  }

  return newPost;
}

export async function deletePost(postId: string): Promise<{ success: boolean; error: any }> {
  try {
    const existing = getLocalSavedPosts();
    const filtered = existing.filter((p) => p.id !== postId);
    localStorage.setItem(SAVED_LOCAL_POSTS_KEY, JSON.stringify(filtered));
    invalidatePostsCache();

    if (isSupabaseConfigured) {
      await supabase.from('posts_reels').delete().eq('id', postId);
      await supabase.from('posts').delete().eq('id', postId);
    }
    return { success: true, error: null };
  } catch (err) {
    console.warn('Post delete notice:', err);
    return { success: false, error: err };
  }
}

export async function createReshare(
  originalPostId: string,
  kind: 'reshare' | 'quote',
  quoteComment?: string
): Promise<Post> {
  const localPosts = getLocalSavedPosts();
  let originalPost = localPosts.find((p) => p.id === originalPostId);

  if (!originalPost && isSupabaseConfigured) {
    try {
      const { data } = await supabase.from('posts').select('*').eq('id', originalPostId).single();
      if (data) {
        originalPost = mapRowToPost(data);
      }
    } catch (e) {
      // ignore
    }
  }

  let userProfile: any = null;
  try {
    const raw = localStorage.getItem('orthodox_user_profile');
    if (raw) userProfile = JSON.parse(raw);
  } catch (e) {}

  const authorName = userProfile?.full_name || 'Parishioner';
  const authorParish = userProfile?.parish || 'Orthodox Church';
  const authorAvatar = userProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
  const authorId = userProfile?.id;

  const resharePayload: Partial<Post> = {
    text: kind === 'quote' && quoteComment ? quoteComment : `Shared reflection from ${originalPost?.authorName || 'Parishioner'}`,
    authorName,
    authorParish,
    authorAvatar,
    authorId,
    quotedPost: originalPost || null,
    reshareKind: kind,
    createdAt: new Date().toISOString(),
  };

  const newPost = await savePost(resharePayload);

  if (originalPost?.authorId && authorId && originalPost.authorId !== authorId) {
    addNotification(
      {
        userId: originalPost.authorId,
        type: 'mention',
        title: `${authorName} reshared your reflection`,
        body: kind === 'quote' && quoteComment ? quoteComment : 'Reshared your reflection with the community.',
        senderName: authorName,
        senderAvatar: authorAvatar,
        link: 'feed',
      },
      authorId
    );
  }

  return newPost;
}

