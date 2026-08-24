/**
 * Posts Service for OrthodoxConnect
 * Backed by Cloudflare Workers API (/api/posts) and Cloudflare D1 SQLite.
 * Integrates directly with Bunny Stream CDN using video GUIDs.
 * Zero Supabase dependencies.
 */

import { Post } from '../types';
import { addNotification } from './notifications';

// Bunny Stream CDN configuration
export const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID || '713265';
export const BUNNY_CDN_HOSTNAME = import.meta.env.VITE_BUNNY_CDN_HOST || 'vz-840ad26e-6fe.b-cdn.net';
export const BUNNY_STREAM_BASE = `https://${BUNNY_CDN_HOSTNAME}`;
export const SEED_VIDEOS: string[] = [];

const API_BASE_URL = ''; // Relative path against Worker or dev server

/**
 * Extracts a canonical Bunny Stream video GUID from any string format
 * (e.g. pure GUID, embed iframe URL, or CDN stream URL).
 */
export function extractBunnyVideoGuid(input?: string | null): string | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // 1. Standard 36-char UUID regex (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
  const match = trimmed.match(guidRegex);
  if (match) {
    return match[1];
  }

  // 2. Direct alphanumeric ID (10+ characters without path/protocol)
  if (/^[0-9a-fA-F-]{10,}$/.test(trimmed) && !trimmed.startsWith('http') && !trimmed.includes('/')) {
    return trimmed;
  }

  // 3. Extract from Bunny iframe or mediadelivery URL
  if (trimmed.includes('mediadelivery.net') || trimmed.includes('bunnycdn.com') || trimmed.includes('b-cdn.net')) {
    const parts = trimmed.split('?')[0].split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && (lastPart.length >= 10 || guidRegex.test(lastPart))) {
      const pMatch = lastPart.match(guidRegex);
      return pMatch ? pMatch[1] : lastPart;
    }
  }

  return trimmed;
}

/**
 * Helper to convert a Cloudflare D1 database row to the frontend Post model
 */
export function mapRowToPost(row: any): Post {
  if (!row || typeof row !== 'object') {
    return {
      id: 'post-' + Date.now(),
      text: '',
      content: '',
      authorName: 'Orthodox Parishioner',
      author_name: 'Orthodox Parishioner',
      authorParish: 'Orthodox Church',
      author_parish: 'Orthodox Church',
      authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  const authorName =
    row.author_name ||
    row.authorName ||
    row.profile?.full_name ||
    row.profiles?.full_name ||
    'Orthodox Parishioner';

  const authorParish =
    row.author_parish ||
    row.authorParish ||
    row.profile?.parish ||
    row.profiles?.parish ||
    'Orthodox Church';

  const authorAvatar =
    row.author_avatar ||
    row.authorAvatar ||
    row.profile?.avatar_url ||
    row.profiles?.avatar_url ||
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

  const authorId = row.author_id || row.authorId || undefined;

  // Bunny Stream video GUID / URL resolution
  const rawVideo = row.video_id || row.videoId || row.video || row.video_url || undefined;
  const videoGuid = extractBunnyVideoGuid(rawVideo);
  const cleanVideo = videoGuid || (rawVideo && /^[0-9a-fA-F-]{10,}$/.test(rawVideo.trim()) ? rawVideo.trim() : undefined);

  const text = (row.content ?? row.text ?? '').trim();
  const rawImage = row.image_url || row.imageUrl || row.image || undefined;
  // Clean media separation: if video is present, suppress image unless explicitly marked
  const finalImage = cleanVideo ? undefined : rawImage;
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();
  const groupId = row.group_id || row.groupId || undefined;

  const likesCount = typeof row.likes_count === 'number' ? row.likes_count : (typeof row.likesCount === 'number' ? row.likesCount : 0);
  const commentsCount = typeof row.comments_count === 'number' ? row.comments_count : (typeof row.commentsCount === 'number' ? row.commentsCount : 0);
  const resharesCount = typeof row.reshares_count === 'number' ? row.reshares_count : (typeof row.resharesCount === 'number' ? row.resharesCount : 0);
  const isLiked = Boolean(row.is_liked || row.isLiked);
  const isReshared = Boolean(row.is_reshared || row.isReshared);

  return {
    id: String(row.id),
    text,
    content: text,
    authorName,
    author_name: authorName,
    authorParish,
    author_parish: authorParish,
    authorAvatar,
    author_avatar: authorAvatar,
    authorId,
    author_id: authorId,
    image: finalImage,
    imageUrl: finalImage,
    image_url: finalImage,
    video: cleanVideo || rawVideo,
    videoId: cleanVideo,
    video_id: cleanVideo,
    audio: row.audio_url || row.audio || row.audioUrl || undefined,
    audioUrl: row.audio_url || row.audio || row.audioUrl || undefined,
    audio_url: row.audio_url || row.audio || row.audioUrl || undefined,
    broadcastUrl: row.broadcast_url || row.broadcastUrl || undefined,
    broadcast_url: row.broadcast_url || row.broadcastUrl || undefined,
    createdAt,
    created_at: createdAt,
    groupId,
    group_id: groupId,
    likesCount,
    likes_count: likesCount,
    commentsCount,
    comments_count: commentsCount,
    resharesCount,
    reshares_count: resharesCount,
    isLiked,
    is_liked: isLiked,
    isReshared,
    is_reshared: isReshared,
    quotedPost: row.quoted_post ? mapRowToPost(row.quoted_post) : (row.quotedPost ? mapRowToPost(row.quotedPost) : null),
    quoted_post: row.quoted_post ? mapRowToPost(row.quoted_post) : (row.quotedPost ? mapRowToPost(row.quotedPost) : null),
    reshareKind: row.reshare_kind || row.reshareKind || undefined,
    reshare_kind: row.reshare_kind || row.reshareKind || undefined,
  };
}

const SAVED_COMMENTS_KEY = 'orthodox_local_comments_v3';
const SAVED_REEL_COMMENTS_KEY = 'orthodox_local_reel_comments_v3';
const SAVED_LIKES_KEY = 'orthodox_local_likes_v3';
const SAVED_LOCAL_POSTS_KEY = 'orthodox_d1_posts_cache_v1';

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

export function sanitizePost(post: any): Post {
  return mapRowToPost(post);
}

export function getLocalSavedPosts(): Post[] {
  try {
    const raw = localStorage.getItem(SAVED_LOCAL_POSTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(mapRowToPost);
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
    const filtered = existing.filter((p) => p.id !== cleanPost.id);
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

// In-memory cache for fast navigation transitions
let cachedPosts: { data: Post[]; timestamp: number; key: string } | null = null;
const CACHE_TTL_MS = 10000;

export function invalidatePostsCache() {
  cachedPosts = null;
}

/**
 * Loads posts from Cloudflare Worker API (GET /api/posts).
 */
export async function loadPosts(
  groupId?: string,
  options?: { limit?: number; offset?: number; forceRefresh?: boolean }
): Promise<{ posts: Post[]; error: any }> {
  const cacheKey = `posts-${groupId || 'all'}-${options?.offset || 0}-${options?.limit || 30}`;
  const localFallback = getLocalSavedPosts().filter((p) => !groupId || p.groupId === groupId);

  if (!options?.forceRefresh && cachedPosts && cachedPosts.key === cacheKey && Date.now() - cachedPosts.timestamp < CACHE_TTL_MS) {
    return { posts: cachedPosts.data, error: null };
  }

  const limit = options?.limit ?? 30;
  const offset = options?.offset ?? 0;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (groupId) {
    params.set('group_id', groupId);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/api/posts?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Worker API HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : (data?.posts || []);
    const mapped = rawList.map(mapRowToPost);

    // Sync to local storage cache
    if (mapped.length > 0) {
      mapped.forEach(saveLocalPostToCache);
    }

    cachedPosts = {
      data: mapped.length > 0 ? mapped : localFallback,
      timestamp: Date.now(),
      key: cacheKey,
    };

    return { posts: mapped.length > 0 ? mapped : localFallback, error: null };
  } catch (err: any) {
    console.warn('[Cloudflare D1 loadPosts notice]:', err?.message || err);
    return { posts: localFallback, error: err?.message || null };
  }
}

/**
 * Loads posts filtered by author from Cloudflare Worker API.
 */
export async function loadPostsByAuthor(authorId: string): Promise<Post[]> {
  const localFallback = getLocalSavedPosts().filter(
    (p) => p.authorId === authorId || p.authorName.toLowerCase().includes(authorId.toLowerCase())
  );

  try {
    const params = new URLSearchParams({
      author_id: authorId,
      limit: '50',
    });

    const res = await fetch(`${API_BASE_URL}/api/posts?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data?.posts || []);
      const mapped = rawList.map(mapRowToPost);
      if (mapped.length > 0) return mapped;
    }
  } catch (err) {
    console.warn('[Cloudflare D1 loadPostsByAuthor notice]:', err);
  }

  return localFallback;
}

/**
 * Loads videos / reels from Cloudflare Worker API (GET /api/posts?video_only=true).
 */
export async function loadVideos(): Promise<Post[]> {
  const localVideos = getLocalSavedPosts().filter(
    (p) => (p.video_id && String(p.video_id).trim() !== '') || (p.video && String(p.video).trim() !== '')
  );

  try {
    const res = await fetch(`${API_BASE_URL}/api/posts?video_only=true&limit=50`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data?.posts || []);
      const mapped = rawList
        .map(mapRowToPost)
        .filter((p: Post) => Boolean((p.video_id && p.video_id.trim() !== '') || (p.video && p.video.trim() !== '')));
      if (mapped.length > 0) return mapped;
    }
  } catch (err) {
    console.warn('[Cloudflare D1 loadVideos notice]:', err);
  }

  return localVideos;
}

export const loadReels = loadVideos;

/**
 * Inserts a new post into Cloudflare D1 via POST /api/posts.
 * Extracts and persists Bunny Stream video GUID.
 */
export async function savePost(postPartial: Partial<Post>): Promise<Post> {
  const videoGuid = postPartial.video_id || extractBunnyVideoGuid(postPartial.video);

  const newPost: Post = {
    id: postPartial.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `post-${Date.now()}`),
    text: postPartial.text || '',
    authorName: postPartial.authorName || 'Orthodox Parishioner',
    authorParish: postPartial.authorParish || 'Orthodox Church',
    authorAvatar:
      postPartial.authorAvatar ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    authorId: postPartial.authorId,
    // Clean Media Separation: If video is present, ensure image is undefined
    image: videoGuid ? undefined : postPartial.image,
    video: videoGuid,
    video_id: videoGuid,
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

  // Optimistic local cache update
  saveLocalPostToCache(newPost);
  invalidatePostsCache();

  const d1Payload = {
    id: newPost.id,
    content: newPost.text,
    video_id: videoGuid || null,
    author_id: newPost.authorId || null,
    author_name: newPost.authorName,
    author_parish: newPost.authorParish,
    author_avatar: newPost.authorAvatar,
    // Clean Media Separation: If video_id exists, image_url must be null in D1 insert payload
    image_url: videoGuid ? null : (postPartial.image || null),
    group_id: newPost.groupId || null,
    likes_count: newPost.likesCount,
    comments_count: newPost.commentsCount,
    reshares_count: newPost.resharesCount,
    created_at: newPost.createdAt,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(d1Payload),
    });

    if (res.ok) {
      const result = await res.json();
      if (result?.post) {
        const saved = mapRowToPost(result.post);
        saveLocalPostToCache(saved);
        return saved;
      }
    } else {
      console.warn('[Cloudflare D1 Post Insert HTTP]:', res.status);
    }
  } catch (err: any) {
    console.warn('[Cloudflare D1 savePost error, using cached]:', err?.message || err);
  }

  return newPost;
}

/**
 * Extracts current user identity headers for role-based Cloudflare Worker requests.
 */
export function getAuthHeaders(overrideProfile?: any): Record<string, string> {
  let profile = overrideProfile;
  if (!profile) {
    try {
      const raw = localStorage.getItem('orthodox_user_profile');
      if (raw) profile = JSON.parse(raw);
    } catch (e) {}
  }

  const email = profile?.email || '';
  const role = profile?.role || 'user';
  const id = profile?.id || '';

  return {
    'x-user-email': email,
    'x-user-role': role,
    'x-user-id': id,
  };
}

/**
 * Toggles like on a post in Cloudflare D1 / Worker backend with optimistic updates.
 */
export async function togglePostLike(
  postId: string,
  userProfile?: any
): Promise<{ success: boolean; liked: boolean; likes_count?: number; likers?: any[] }> {
  let profile = userProfile;
  if (!profile) {
    try {
      const raw = localStorage.getItem('orthodox_user_profile');
      if (raw) profile = JSON.parse(raw);
    } catch (e) {}
  }

  const userId = profile?.id || (profile?.email ? `user-${profile.email}` : 'anonymous-user');
  const authorName = profile?.full_name || 'Orthodox Parishioner';
  const authorAvatar = profile?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(profile),
    };
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        user_name: authorName,
        user_avatar: authorAvatar,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      invalidatePostsCache();
      return {
        success: true,
        liked: Boolean(data.is_liked ?? data.liked),
        likes_count: typeof data.likes_count === 'number' ? data.likes_count : undefined,
        likers: data.likers || [],
      };
    }
  } catch (err) {
    console.warn('[Cloudflare D1 togglePostLike notice]:', err);
  }

  return { success: false, liked: false };
}

/**
 * Fetches the list of likers for a specific post.
 */
export async function fetchPostLikes(postId: string): Promise<{ userId: string; userName: string; userAvatar?: string; parish?: string }[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/likes`);
    if (res.ok) {
      const data = await res.json();
      if (data?.likes && Array.isArray(data.likes)) {
        return data.likes.map((r: any) => ({
          userId: r.user_id || r.userId,
          userName: r.user_name || r.userName || 'Orthodox Member',
          userAvatar: r.user_avatar || r.userAvatar,
          parish: r.parish || 'Orthodox Parish',
        }));
      }
    }
  } catch (err) {
    console.warn('[Cloudflare D1 fetchPostLikes notice]:', err);
  }
  return [];
}

/**
 * Fetches comments for a specific post from Cloudflare D1.
 */
export async function fetchPostComments(postId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`);
    if (res.ok) {
      const data = await res.json();
      if (data?.comments && Array.isArray(data.comments)) {
        return data.comments.map((c: any) => ({
          id: c.id,
          postId: c.post_id || postId,
          post_id: c.post_id || postId,
          userId: c.user_id,
          user_id: c.user_id,
          authorName: c.author_name || 'Orthodox Parishioner',
          author_name: c.author_name || 'Orthodox Parishioner',
          authorAvatar: c.author_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
          author_avatar: c.author_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
          content: c.content,
          createdAt: c.created_at || new Date().toISOString(),
          created_at: c.created_at || new Date().toISOString(),
        }));
      }
    }
  } catch (err) {
    console.warn('[Cloudflare D1 fetchPostComments notice]:', err);
  }

  // Fallback to local map comments
  const localMap = loadLocalPostCommentsMap();
  const strings = localMap[postId] || [];
  return strings.map((text, idx) => ({
    id: `local-comm-${idx}`,
    postId,
    post_id: postId,
    content: text,
    authorName: 'Orthodox Parishioner',
    author_name: 'Orthodox Parishioner',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }));
}

/**
 * Adds a comment to a post in Cloudflare D1.
 */
export async function addPostComment(
  postId: string,
  content: string,
  userProfile?: any
): Promise<{ success: boolean; comment?: any; comments_count?: number; error?: any }> {
  const text = content.trim();
  if (!text) return { success: false, error: 'Empty comment' };

  let profile = userProfile;
  if (!profile) {
    try {
      const raw = localStorage.getItem('orthodox_user_profile');
      if (raw) profile = JSON.parse(raw);
    } catch (e) {}
  }

  const userId = profile?.id || (profile?.email ? `user-${profile.email}` : null);
  const authorName = profile?.full_name || 'Orthodox Parishioner';
  const authorAvatar = profile?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

  const newComment = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `comm-${Date.now()}`,
    post_id: postId,
    postId,
    user_id: userId,
    userId,
    author_name: authorName,
    authorName,
    author_avatar: authorAvatar,
    authorAvatar,
    content: text,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(profile),
    };
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newComment),
    });

    if (res.ok) {
      const data = await res.json();
      invalidatePostsCache();
      return {
        success: true,
        comment: data?.comment || newComment,
        comments_count: data?.comments_count,
      };
    }
  } catch (err: any) {
    console.warn('[Cloudflare D1 addPostComment notice]:', err);
  }

  return { success: true, comment: newComment };
}

/**
 * Deletes a comment from Cloudflare D1.
 */
export async function deletePostComment(
  postId: string,
  commentId: string,
  userProfile?: any
): Promise<{ success: boolean; comments_count?: number; error?: any }> {
  try {
    const headers = getAuthHeaders(userProfile);
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers,
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      invalidatePostsCache();
      return { success: true, comments_count: data?.comments_count };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || `HTTP ${res.status}` };
  } catch (err: any) {
    console.warn('[Cloudflare D1 deletePostComment notice]:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Deletes a post from Cloudflare D1 via DELETE /api/posts/:id with user identity headers.
 */
export async function deletePost(postId: string, userProfile?: any): Promise<{ success: boolean; error: any }> {
  try {
    const existing = getLocalSavedPosts();
    const filtered = existing.filter((p) => p.id !== postId);
    localStorage.setItem(SAVED_LOCAL_POSTS_KEY, JSON.stringify(filtered));
    invalidatePostsCache();

    const headers = getAuthHeaders(userProfile);

    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.warn('[Cloudflare D1 deletePost notice]:', err);
    return { success: false, error: err?.message || err };
  }
}

/**
 * Deletes a user account from Cloudflare D1 via DELETE /api/users/:id with user identity headers.
 */
export async function deleteUserApi(
  userId: string,
  targetEmail?: string,
  targetRole?: string,
  userProfile?: any
): Promise<{ success: boolean; error: any }> {
  try {
    const headers = {
      ...getAuthHeaders(userProfile),
      'x-target-email': targetEmail || '',
      'x-target-role': targetRole || 'user',
    };

    const queryParams = new URLSearchParams();
    if (targetEmail) queryParams.set('target_email', targetEmail);
    if (targetRole) queryParams.set('target_role', targetRole);

    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}${qs}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.warn('[Cloudflare D1 deleteUserApi notice]:', err);
    return { success: false, error: err?.message || err };
  }
}

/**
 * Creates a post reshare or quote post.
 */
export async function createReshare(
  originalPostId: string,
  kind: 'reshare' | 'quote',
  quoteComment?: string
): Promise<Post> {
  const localPosts = getLocalSavedPosts();
  let originalPost = localPosts.find((p) => p.id === originalPostId);

  if (!originalPost) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(originalPostId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.post) {
          originalPost = mapRowToPost(data.post);
        }
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
  const authorAvatar =
    userProfile?.avatar_url ||
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
  const authorId = userProfile?.id;

  const resharePayload: Partial<Post> = {
    text:
      kind === 'quote' && quoteComment
        ? quoteComment
        : `Shared reflection from ${originalPost?.authorName || 'Parishioner'}`,
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
