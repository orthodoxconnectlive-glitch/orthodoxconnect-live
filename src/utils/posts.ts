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

export function extractBunnyVideoGuid(input?: string | null): string | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
  const match = trimmed.match(guidRegex);
  if (match) return match[1];

  if (/^[0-9a-fA-F-]{10,}$/.test(trimmed) && !trimmed.startsWith('http') && !trimmed.includes('/')) {
    return trimmed;
  }

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
  const rawVideo = row.video_id || row.videoId || row.video || row.video_url || undefined;
  const videoGuid = extractBunnyVideoGuid(rawVideo);
  const cleanVideo = videoGuid || (rawVideo && /^[0-9a-fA-F-]{10,}$/.test(rawVideo.trim()) ? rawVideo.trim() : undefined);

  const text = (row.content ?? row.text ?? '').trim();
  const rawImage = row.image_url || row.imageUrl || row.image || undefined;
  const finalImage = cleanVideo ? undefined : rawImage;
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();
  const groupId = row.group_id || row.groupId || undefined;

  const likesCount = Number(row.likes_count ?? row.likesCount ?? 0);
  const commentsCount = Number(row.comments_count ?? row.commentsCount ?? 0);
  const resharesCount = Number(row.reshares_count ?? row.resharesCount ?? 0);
  const isLiked = Boolean(row.is_liked || row.isLiked);
  const isReshared = Boolean(row.is_reshared || row.isReshared);
  const likers = Array.isArray(row.likers) ? row.likers : [];

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
    likers,
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

export function sanitizePost(post: any): Post {
  return mapRowToPost(post);
}

// 5-second in-memory cache to prevent duplicate calls during re-renders
let cachedPosts: { data: Post[]; timestamp: number; key: string } | null = null;
const CACHE_TTL_MS = 5000;
let rateLimitedUntil = 0;
let activeInFlightPromise: Promise<{ posts: Post[]; error: any }> | null = null;

export function invalidatePostsCache() {
  cachedPosts = null;
}

/**
 * Guarantees every user/device receives a unique, isolated identity
 * to eliminate fallback identity collision.
 */
export function getActiveUserIdentity(overrideProfile?: any): {
  userId: string;
  userName: string;
  userAvatar: string;
  email: string;
  role: string;
} {
  let profile = overrideProfile;
  if (!profile) {
    try {
      const raw =
        localStorage.getItem('orthodox_user_profile') ||
        localStorage.getItem('user') ||
        localStorage.getItem('profile');
      if (raw) profile = JSON.parse(raw);
    } catch (e) {}
  }

  // 1. Authenticated user ID
  if (profile?.id) {
    return {
      userId: String(profile.id),
      userName: profile.full_name || profile.name || 'Orthodox Parishioner',
      userAvatar:
        profile.avatar_url ||
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      email: profile.email || '',
      role: profile.role || 'user',
    };
  }

  // 2. Email-derived user ID
  if (profile?.email) {
    return {
      userId: `user-${profile.email.trim().toLowerCase()}`,
      userName: profile.full_name || profile.email.split('@')[0],
      userAvatar:
        profile.avatar_url ||
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      email: profile.email,
      role: profile.role || 'user',
    };
  }

  // 3. Persistent unique client/device UUID (Never falls back to a shared 'anonymous-user')
  let guestId = '';
  try {
    guestId = localStorage.getItem('orthodox_client_device_id') || '';
    if (!guestId) {
      guestId =
        'client_' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
      localStorage.setItem('orthodox_client_device_id', guestId);
    }
  } catch (e) {
    guestId = `client_${Date.now()}`;
  }

  return {
    userId: guestId,
    userName: 'Orthodox Parishioner',
    userAvatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    email: '',
    role: 'guest',
  };
}

export function getAuthHeaders(overrideProfile?: any): Record<string, string> {
  const identity = getActiveUserIdentity(overrideProfile);
  return {
    'x-user-email': identity.email,
    'x-user-role': identity.role,
    'x-user-id': identity.userId,
  };
}

/**
 * Loads posts directly from Cloudflare Worker API (GET /api/posts).
 */
export async function loadPosts(
  groupId?: string,
  options?: { limit?: number; offset?: number; forceRefresh?: boolean }
): Promise<{ posts: Post[]; error: any }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const cacheKey = `posts-${groupId || 'all'}-${offset}-${limit}`;

  if (!options?.forceRefresh && cachedPosts && cachedPosts.key === cacheKey && Date.now() - cachedPosts.timestamp < CACHE_TTL_MS) {
    return { posts: cachedPosts.data, error: null };
  }

  if (Date.now() < rateLimitedUntil) {
    return { posts: cachedPosts?.data || [], error: 'Rate limit active. Please try again shortly.' };
  }

  if (activeInFlightPromise) {
    return activeInFlightPromise;
  }

  activeInFlightPromise = (async () => {
    const identity = getActiveUserIdentity();
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      user_id: identity.userId,
    });
    if (groupId) {
      params.set('group_id', groupId);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/posts?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
      });

      if (res.status === 429) {
        rateLimitedUntil = Date.now() + 15000;
        throw new Error('API Error 429: Too Many Requests');
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`API Error ${res.status}: ${errText || res.statusText}`);
      }

      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data?.posts || []);
      const mapped = rawList
        .map(mapRowToPost)
        .sort((a: Post, b: Post) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      cachedPosts = {
        data: mapped,
        timestamp: Date.now(),
        key: cacheKey,
      };

      return { posts: mapped, error: null };
    } catch (err: any) {
      console.warn('[loadPosts error]:', err?.message || err);
      return { posts: cachedPosts?.data || [], error: err?.message || 'Failed to load posts' };
    } finally {
      activeInFlightPromise = null;
    }
  })();

  return activeInFlightPromise;
}

export async function loadPostsByAuthor(authorId: string): Promise<Post[]> {
  try {
    const params = new URLSearchParams({ author_id: authorId, limit: '50' });
    const res = await fetch(`${API_BASE_URL}/api/posts?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...getAuthHeaders() },
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data?.posts || []);
      return rawList
        .map(mapRowToPost)
        .sort((a: Post, b: Post) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {}
  return [];
}

export async function loadVideos(): Promise<Post[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/posts?video_only=true&limit=50`, {
      method: 'GET',
      headers: { Accept: 'application/json', ...getAuthHeaders() },
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data?.posts || []);
      return rawList
        .map(mapRowToPost)
        .filter((p: Post) => Boolean((p.video_id && p.video_id.trim() !== '') || (p.video && p.video.trim() !== '')))
        .sort((a: Post, b: Post) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {}
  return [];
}

export const loadReels = loadVideos;

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
    image: videoGuid ? undefined : postPartial.image,
    video: videoGuid,
    video_id: videoGuid,
    audio: postPartial.audio || postPartial.audioUrl,
    audioUrl: postPartial.audioUrl || postPartial.audio,
    broadcastUrl: postPartial.broadcastUrl,
    createdAt: postPartial.createdAt || new Date().toISOString(),
    groupId: postPartial.groupId,
    likesCount: postPartial.likesCount || 0,
    likers: postPartial.likers || [],
    commentsCount: postPartial.commentsCount || 0,
    resharesCount: postPartial.resharesCount || 0,
    quotedPost: postPartial.quotedPost,
    reshareKind: postPartial.reshareKind,
  };

  invalidatePostsCache();

  const d1Payload = {
    id: newPost.id,
    content: newPost.text,
    video_id: videoGuid || null,
    author_id: newPost.authorId || null,
    author_name: newPost.authorName,
    author_parish: newPost.authorParish,
    author_avatar: newPost.authorAvatar,
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
        ...getAuthHeaders(),
      },
      body: JSON.stringify(d1Payload),
    });

    if (res.ok) {
      const result = await res.json();
      if (result?.post) {
        return mapRowToPost(result.post);
      }
    }
  } catch (err: any) {
    console.warn('[savePost error]:', err?.message || err);
  }

  return newPost;
}

export async function togglePostLike(
  postId: string,
  userProfile?: any
): Promise<{ success: boolean; liked: boolean; likes_count?: number; likers?: any[] }> {
  const identity = getActiveUserIdentity(userProfile);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(userProfile),
    };

    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: identity.userId,
        user_name: identity.userName,
        user_avatar: identity.userAvatar,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      invalidatePostsCache();
      return {
        success: true,
        liked: Boolean(data.is_liked ?? data.liked),
        likes_count: typeof data.likes_count === 'number' ? data.likes_count : (data.likesCount ?? undefined),
        likers: data.likers || [],
      };
    }
  } catch (err) {
    console.error('[togglePostLike error]:', err);
  }

  return { success: false, liked: false };
}

export async function fetchPostLikes(postId: string): Promise<{ userId: string; userName: string; userAvatar?: string; parish?: string }[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/likes`, {
      headers: getAuthHeaders(),
    });
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
  } catch (err) {}
  return [];
}

export async function fetchPostComments(postId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`, {
      headers: getAuthHeaders(),
    });
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
  } catch (err) {}
  return [];
}

export async function addPostComment(
  postId: string,
  content: string,
  userProfile?: any
): Promise<{ success: boolean; comment?: any; comments_count?: number; error?: any }> {
  const text = content.trim();
  if (!text) return { success: false, error: 'Empty comment' };

  const identity = getActiveUserIdentity(userProfile);

  const newComment = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `comm-${Date.now()}`,
    post_id: postId,
    postId,
    user_id: identity.userId,
    userId: identity.userId,
    author_name: identity.userName,
    authorName: identity.userName,
    author_avatar: identity.userAvatar,
    authorAvatar: identity.userAvatar,
    content: text,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(userProfile),
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
  } catch (err) {}

  return { success: true, comment: newComment };
}

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
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function deletePost(postId: string, userProfile?: any): Promise<{ success: boolean; error: any }> {
  try {
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
    return { success: false, error: err?.message || err };
  }
}

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
    return { success: false, error: err?.message || err };
  }
}

export async function createReshare(
  originalPostId: string,
  kind: 'reshare' | 'quote',
  quoteComment?: string
): Promise<Post> {
  let originalPost: Post | undefined;

  try {
    const res = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(originalPostId)}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.post) {
        originalPost = mapRowToPost(data.post);
      }
    }
  } catch (e) {}

  const identity = getActiveUserIdentity();
  const authorName = identity.userName;
  const authorParish = 'Orthodox Church';
  const authorAvatar = identity.userAvatar;
  const authorId = identity.userId;

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
