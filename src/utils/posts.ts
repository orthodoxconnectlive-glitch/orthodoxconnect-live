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

// Default community posts for resilient offline/cold-start fallback
export const DEFAULT_COMMUNITY_POSTS: Post[] = [
  {
    id: 'orthodox-post-seed-1',
    text: '“Let nothing perturb you, nothing frighten you. All things are passing; God never changes. Patience obtains all things.” — St. Teresa & The Desert Fathers. Blessed Sunday to all our brethren across all parishes! ☨ #Orthodoxy #Faith #DesertFathers',
    authorName: 'Fr. Athanasios',
    authorParish: "St. Anthony's Monastery",
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    likesCount: 38,
    commentsCount: 7,
    resharesCount: 12,
  },
  {
    id: 'orthodox-post-seed-2',
    text: 'Tonight after Vespers, our parish youth and choir gathered for the chanting of the Agni Parthene. Glory to God for all things! 🕊️ #Vespers #ByzantineChant #AgniParthene',
    authorName: 'Deacon Mark',
    authorParish: 'Annunciation Orthodox Church',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    image: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=800',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    likesCount: 54,
    commentsCount: 12,
    resharesCount: 19,
  },
  {
    id: 'orthodox-post-seed-3',
    text: 'A blessed feast to everyone on the memorial of the Holy Apostles. May their prayers protect our homes, our parishes, and all the faithful. ☨ #HolyApostles #OrthodoxConnect #FeastDay',
    authorName: 'Maria Sophia',
    authorParish: 'Holy Trinity Cathedral',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    likesCount: 29,
    commentsCount: 4,
    resharesCount: 6,
  },
];

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
        return parsed.map(sanitizePost);
      }
    }
  } catch (e: any) {
    console.warn('Error reading local saved posts:', e?.message || String(e));
  }
  return DEFAULT_COMMUNITY_POSTS;
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

// Timeout helper to avoid stalling on cold Supabase Postgres connections
async function fetchWithTimeout<T>(promise: Promise<T>, timeoutMs = 3500): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('QUERY_TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
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
    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    const res = await fetchWithTimeout(query as any, 4000);
    const { data, error } = res as any;

    if (error) {
      // If code 57014 (canceling statement due to statement timeout) or similar occurs
      if (error.code === '57014' || error.message?.includes('timeout')) {
        console.warn('[Supabase loadPosts] Query statement timeout (57014). Attempting fallback select...');
        try {
          let fallbackQuery = supabase
            .from('posts')
            .select('*')
            .limit(limit);
          if (groupId) fallbackQuery = fallbackQuery.eq('group_id', groupId);

          const { data: fbData, error: fbErr } = await fallbackQuery;
          if (!fbErr && fbData && fbData.length > 0) {
            const dbPosts = fbData.map(mapRowToPost);
            return { posts: dbPosts, error: null };
          }
        } catch (fbException) {
          console.warn('[Supabase loadPosts fallback exception]:', fbException);
        }
      }

      console.warn('[Supabase loadPosts notice]:', error.message || error);
      return { posts: localPosts, error: null };
    }

    if (data && data.length > 0) {
      const dbPosts = data.map(mapRowToPost);
      // Combine with local cached posts (for offline/instant optimism)
      const combined = [...dbPosts];
      localPosts.forEach((lp) => {
        if (!combined.some((p) => p.id === lp.id || (p.text === lp.text && p.createdAt === lp.createdAt))) {
          combined.push(lp);
        }
      });
      return { posts: combined, error: null };
    }
  } catch (err: any) {
    console.warn('[Supabase loadPosts caught notice/timeout]:', err?.message || err);
    return { posts: localPosts, error: null };
  }

  return { posts: localPosts, error: null };
}

/**
  * Mandatory Export: loadPostsByAuthor(authorId)
  * Fetches posts written by a specific author directly from Supabase
  */
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
    text: 'The Divine Liturgy & the Light of Christ at St. Anthony Monastery. Blessed Sunday everyone! #Orthodox #Christianity #Liturgy #Byzantine #JesusPrayer #MountAthos',
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
  {
    id: 'orthodox-reel-2',
    text: 'A profound reflection on the Jesus Prayer: "Lord Jesus Christ, Son of God, have mercy on me, a sinner." #JesusPrayer #Hesychasm #Orthodox #Prayer #SpiritualLife #Saints',
    authorName: 'Orthodox Connect',
    authorParish: 'Holy Trinity Cathedral',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    image: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=800',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    likesCount: 2850,
    commentsCount: 142,
    resharesCount: 520,
  },
  {
    id: 'orthodox-reel-3',
    text: 'Paschal Vigil and the Resurrection Light: "Christ is Risen from the dead, trampling down death by death!" ☨ #Pascha #Resurrection #Orthodox #ChristIsRisen #Orthodoxy',
    authorName: 'Deacon Mark',
    authorParish: 'Annunciation Orthodox Church',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    image: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    likesCount: 960,
    commentsCount: 45,
    resharesCount: 180,
  },
];

/**
  * Mandatory Export: loadVideos() / loadReels()
  * Fetches video posts where video is not null directly from Supabase
  */
export async function loadVideos(): Promise<Post[]> {
  const localReels = getLocalSavedPosts().filter((p) => !!p.video);
  if (!isSupabaseConfigured) {
    return localReels.length > 0 ? localReels : DEFAULT_ORTHODOX_VIDEOS;
  }

  try {
    const reelsPromise = supabase
      .from('posts_reels')
      .select('*')
      .order('created_at', { ascending: false });

    const reelsRes = await fetchWithTimeout(reelsPromise as any, 3500);
    const { data: reelsData, error: reelsError } = (reelsRes || {}) as any;

    if (!reelsError && reelsData && reelsData.length > 0) {
      return reelsData.map(mapRowToPost);
    }
    if (reelsError) {
      console.warn('Videos fetch notice:', reelsError.message || reelsError);
    }

    const postsPromise = supabase
      .from('posts')
      .select('*')
      .or('video.not.is.null,video_url.not.is.null')
      .order('created_at', { ascending: false });

    const postsRes = await fetchWithTimeout(postsPromise as any, 3500);
    const { data: postsData, error: postsError } = (postsRes || {}) as any;

    if (!postsError && postsData && postsData.length > 0) {
      return postsData.map(mapRowToPost);
    }
    if (postsError) {
      console.warn('Posts video fetch notice:', postsError.message || postsError);
    }
  } catch (err) {
    console.warn('Videos fetch notice:', err);
  }

  return localReels.length > 0 ? localReels : DEFAULT_ORTHODOX_VIDEOS;
}

export const loadReels = loadVideos;

/**
  * Mandatory Export: savePost(post)
  * Inserts a post directly into Supabase and dispatches real-time notification
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

  // Cache locally immediately for optimistic UI & offline resilience
  saveLocalPostToCache(newPost);

  if (!isSupabaseConfigured) {
    console.info('[Post Persistence] Supabase not configured. Saved to local persistent cache.');
    addNotification({
      userId: 'all',
      type: 'mention',
      title: `New Post from ${newPost.authorName}`,
      body: newPost.text ? (newPost.text.length > 80 ? newPost.text.slice(0, 80) + '...' : newPost.text) : 'Shared a new reflection.',
      senderName: newPost.authorName,
      senderAvatar: newPost.authorAvatar,
      link: 'feed',
    });
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
      const { error: reelsErr } = await supabase.from('posts_reels').insert([{
        content: newPost.text,
        author_name: newPost.authorName,
        author_parish: newPost.authorParish,
        author_avatar: newPost.authorAvatar,
        author_id: isUuid ? newPost.authorId : null,
        video_url: newPost.video,
        created_at: newPost.createdAt,
      }]);
      if (reelsErr) {
        console.error('[Supabase posts_reels Insert Error]:', {
          message: reelsErr.message,
          details: reelsErr.details,
          hint: reelsErr.hint,
          code: reelsErr.code,
        });
      }
    } catch (reelsErr: any) {
      console.error('[Supabase posts_reels Exception]:', reelsErr?.message || reelsErr);
    }
  }

  try {
    console.log('[Supabase] Executing direct database insert into "posts":', dbPayload);
    const { data, error } = await supabase.from('posts').insert([dbPayload]).select();

    if (error) {
      console.error('[Supabase Post Insert Error]:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      // If missing column error, try minimal payload fallback
      if (error.code === '42703' || error.message?.includes('column')) {
        console.warn('[Supabase] Column mismatch detected, attempting simplified insert fallback...');
        const fallbackPayload: Record<string, any> = {
          content: newPost.text,
          image_url: newPost.image || null,
          video_url: newPost.video || null,
          created_at: newPost.createdAt,
        };
        if (isUuid) fallbackPayload.author_id = newPost.authorId;

        const { data: fbData, error: fbError } = await supabase
          .from('posts')
          .insert([fallbackPayload])
          .select();

        if (fbError) {
          console.error('[Supabase Fallback Insert Error]:', fbError);
        } else if (fbData && fbData.length > 0) {
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

      console.log('[Supabase] Post persisted successfully to database with ID:', saved.id);
      saveLocalPostToCache(saved);

      // Trigger real notification record in Supabase notifications table
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

/**
  * Mandatory Export: loadPost(postId)
  */
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

    if (error) {
      console.warn('Load single post note:', error.message || error);
    }

    if (!error && data) {
      return mapRowToPost(data);
    }
  } catch (err) {
    console.warn('Load single post notice:', err);
  }

  return null;
}

/**
  * Mandatory Export: deletePost(postId)
  */
export async function deletePost(postId: string): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
    if (!isUuid || !isSupabaseConfigured) return true;

    const { error: reelsErr } = await supabase.from('posts_reels').delete().eq('id', postId);
    if (reelsErr) console.warn('Delete reel note:', reelsErr.message || reelsErr);

    const { error: postsErr } = await supabase.from('posts').delete().eq('id', postId);
    if (postsErr) console.warn('Delete post note:', postsErr.message || postsErr);
  } catch (err) {
    console.warn('Delete post notice:', err);
  }

  return true;
}

/**
  * Mandatory Export: createReshare(postId, kind, quote)
  * Handles post reshares and quote posts
  */
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

