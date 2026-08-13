import { supabase } from '../lib/supabase';
import { Post } from '../types';
import { addNotification } from './notifications';

// Bunny Stream video links (Library ID: 713265)
export const BUNNY_STREAM_BASE = 'https://video.bunnycdn.com/play/713265';
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
  * Mandatory Export: loadPosts(groupId?, options?)
  * Fetches main feed posts directly from Supabase posts table
  */
export async function loadPosts(
  groupId?: string,
  options?: { limit?: number; offset?: number }
): Promise<{ posts: Post[]; error: any }> {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;

  try {
    let query = supabase
      .from('posts')
      .select('id, content, text, author_id, author_name, author_parish, author_avatar, image_url, video_url, created_at, group_id, likes_count, comments_count, reshares_count, profiles(id, full_name, username, parish, avatar_url)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    let { data, error } = await query;

    if (error) {
      console.warn('[loadPosts] Error with specific columns query, retrying fallback select:', error.message);
      let fallbackQuery = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (groupId) {
        fallbackQuery = fallbackQuery.eq('group_id', groupId);
      }

      const res = await fallbackQuery;
      data = res.data;
      error = res.error;
    }

    if (error) {
      return { posts: [], error };
    }

    if (data) {
      const posts = data.map(mapRowToPost);
      return { posts, error: null };
    }
  } catch (err: any) {
    console.error('[loadPosts] Exception:', err);
    return { posts: [], error: err };
  }

  return { posts: [], error: null };
}

/**
  * Mandatory Export: loadPostsByAuthor(authorId)
  * Fetches posts written by a specific author directly from Supabase
  */
export async function loadPostsByAuthor(authorId: string): Promise<Post[]> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authorId);
    let query = supabase.from('posts').select('*, profiles(*)');

    if (isUuid) {
      query = query.or(`author_id.eq.${authorId},author_name.ilike.%${authorId}%`);
    } else {
      query = query.ilike('author_name', `%${authorId}%`);
    }

    let { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      let fallbackQuery = supabase.from('posts').select('*');
      if (isUuid) {
        fallbackQuery = fallbackQuery.or(`author_id.eq.${authorId},author_name.ilike.%${authorId}%`);
      } else {
        fallbackQuery = fallbackQuery.ilike('author_name', `%${authorId}%`);
      }
      const fallback = await fallbackQuery.order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('[Supabase loadPostsByAuthor] Error:', error);
      return [];
    }

    if (data) {
      const result = data.map(mapRowToPost);
      console.log(`[Supabase loadPostsByAuthor] Count for ${authorId}:`, result.length);
      return result;
    }
  } catch (err) {
    console.error('[Supabase loadPostsByAuthor] Exception:', err);
  }

  return [];
}

/**
  * Mandatory Export: loadReels()
  * Fetches short-form video posts where video is not null directly from Supabase
  */
export async function loadReels(): Promise<Post[]> {
  try {
    // Try querying posts_reels table first
    const { data: reelsData, error: reelsError } = await supabase
      .from('posts_reels')
      .select('*')
      .order('created_at', { ascending: false });

    if (!reelsError && reelsData && reelsData.length > 0) {
      return reelsData.map(mapRowToPost);
    }

    // Fallback to posts table where video or video_url is not null
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .or('video.not.is.null,video_url.not.is.null')
      .order('created_at', { ascending: false });

    if (!postsError && postsData) {
      return postsData.map(mapRowToPost);
    }
  } catch (err) {
    console.warn('Supabase loadReels error:', err);
  }

  return [];
}

/**
  * Mandatory Export: savePost(post)
  * Inserts a post directly into Supabase and dispatches real-time notification
  */
export async function savePost(postPartial: Partial<Post>): Promise<Post> {
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

  const dbPayload = {
    content: newPost.text,
    author_name: newPost.authorName,
    author_parish: newPost.authorParish,
    author_avatar: newPost.authorAvatar,
    author_id: newPost.authorId,
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
        author_id: newPost.authorId,
        video_url: newPost.video,
        created_at: newPost.createdAt,
      }]);
    } catch (reelsErr) {
      console.warn('Note: posts_reels insert notice:', reelsErr);
    }
  }

  try {
    const { data, error } = await supabase.from('posts').insert([dbPayload]).select();
    if (error) {
      console.error('[savePost] Supabase insert error:', error);
    } else if (data && data.length > 0) {
      const saved = mapRowToPost(data[0]);
      if (!saved.image && newPost.image) saved.image = newPost.image;
      if (!saved.video && newPost.video) saved.video = newPost.video;

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
  } catch (err) {
    console.error('[savePost] Exception:', err);
  }

  return newPost;
}

/**
  * Mandatory Export: loadPost(postId)
  */
export async function loadPost(postId: string): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .eq('id', postId)
      .single();

    if (!error && data) {
      return mapRowToPost(data);
    }
  } catch (err) {
    console.warn('loadPost error:', err);
  }

  return null;
}

/**
  * Mandatory Export: deletePost(postId)
  */
export async function deletePost(postId: string): Promise<boolean> {
  try {
    await supabase.from('posts_reels').delete().eq('id', postId);
    await supabase.from('posts').delete().eq('id', postId);
  } catch (err) {
    console.warn('deletePost error:', err);
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

