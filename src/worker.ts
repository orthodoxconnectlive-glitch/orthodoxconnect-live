/**
 * Cloudflare Worker API for OrthodoxConnect
 * Handles /api/posts endpoints with Cloudflare D1 SQLite database (binding: DB)
 * and Bunny Stream video integration.
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[]; meta: any }>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[] }[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  DB: D1Database;
  BUNNY_LIBRARY_ID?: string;
  BUNNY_API_KEY?: string;
  BUNNY_CDN_HOST?: string;
}

export interface D1PostRow {
  id: string;
  content: string;
  video_id: string | null;
  author_id: string | null;
  author_name: string | null;
  author_parish: string | null;
  author_avatar: string | null;
  image_url: string | null;
  group_id: string | null;
  likes_count: number;
  comments_count: number;
  reshares_count: number;
  created_at: string;
}

const DEFAULT_BUNNY_LIBRARY_ID = '713265';
const DEFAULT_BUNNY_API_KEY = '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';
const DEFAULT_BUNNY_CDN_HOST = 'vz-840ad26e-6fe.b-cdn.net';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, X-User-Email, X-User-Role, X-User-Id, x-user-email, x-user-role, x-user-id, x-target-email, x-target-role',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};

export const SUPER_ADMIN_EMAIL = 'orthodoxconnect.live@gmail.com';

export function getAuthIdentity(request: Request) {
  const email = (
    request.headers.get('x-user-email') ||
    request.headers.get('X-User-Email') ||
    ''
  ).trim().toLowerCase();

  const role = (
    request.headers.get('x-user-role') ||
    request.headers.get('X-User-Role') ||
    ''
  ).trim().toLowerCase();

  const id = (
    request.headers.get('x-user-id') ||
    request.headers.get('X-User-Id') ||
    ''
  ).trim();

  const isSuperAdmin = email === SUPER_ADMIN_EMAIL || role === 'super_admin';
  const isAdmin = isSuperAdmin || role === 'admin' || role === 'owner';

  return { email, role, id, isSuperAdmin, isAdmin };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * Extracts a clean Bunny Stream video GUID from any string format
 * (e.g. pure GUID, embed iframe URL, or CDN direct stream URL).
 */
export function extractBunnyVideoGuid(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Match canonical UUID v4 / GUID pattern
  const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
  const match = trimmed.match(guidRegex);
  if (match) {
    return match[1];
  }

  // If already an alphanumeric identifier
  if (/^[0-9a-zA-Z_-]{10,}$/.test(trimmed) && !trimmed.startsWith('http')) {
    return trimmed;
  }

  return trimmed;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight for all endpoints
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      // 2. Health check endpoint
      if (url.pathname === '/api/health') {
        return jsonResponse({
          status: 'ok',
          service: 'orthodoxconnect-worker-d1',
          d1_connected: Boolean(env.DB),
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Bunny Stream: Video Creation Initiation Endpoint
      // POST /api/bunny/create-video - Creates a video record in Bunny Stream
      if (url.pathname === '/api/bunny/create-video' || url.pathname === '/api/bunny/create-video/') {
        if (request.method !== 'POST') {
          return jsonResponse({ success: false, error: `Method ${request.method} not allowed` }, 405);
        }

        const body: any = await request.json().catch(() => ({}));
        const videoTitle = body.title || `Orthodox_Video_${Date.now()}`;
        const libraryId = env.BUNNY_LIBRARY_ID || DEFAULT_BUNNY_LIBRARY_ID;
        const apiKey = env.BUNNY_API_KEY || DEFAULT_BUNNY_API_KEY;

        const bunnyRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
          method: 'POST',
          headers: {
            AccessKey: apiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ title: videoTitle }),
        });

        if (!bunnyRes.ok) {
          const errText = await bunnyRes.text();
          return jsonResponse(
            { success: false, error: `Bunny Stream API Error: ${bunnyRes.status} ${errText}` },
            bunnyRes.status
          );
        }

        const data: any = await bunnyRes.json();
        const guid = data.guid;
        const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=false&loop=false&muted=false&preload=true`;

        return jsonResponse({
          success: true,
          guid,
          libraryId,
          embedUrl,
          directUploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
        }, 201);
      }

      // 4. Collection endpoints: /api/posts or /api/posts/
      if (url.pathname === '/api/posts' || url.pathname === '/api/posts/') {
        // GET: Fetch posts ordered by created_at DESC with pagination and filters
        if (request.method === 'GET') {
          const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
          const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
          const authorId = url.searchParams.get('author_id') || url.searchParams.get('authorId');
          const groupId = url.searchParams.get('group_id') || url.searchParams.get('groupId');
          const videoOnly =
            url.searchParams.get('video_only') === 'true' ||
            url.searchParams.get('videos') === 'true';

          let query = 'SELECT * FROM posts';
          const conditions: string[] = [];
          const params: any[] = [];

          if (authorId) {
            conditions.push('(author_id = ? OR author_name LIKE ?)');
            params.push(authorId, `%${authorId}%`);
          }

          if (groupId) {
            conditions.push('group_id = ?');
            params.push(groupId);
          }

          if (videoOnly) {
            conditions.push("(video_id IS NOT NULL AND video_id != '')");
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }

          query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
          params.push(limit, offset);

          let posts: D1PostRow[] = [];

          if (env.DB) {
            const stmt = env.DB.prepare(query).bind(...params);
            const { results } = await stmt.all<D1PostRow>();
            posts = results || [];
          }

          return jsonResponse({
            success: true,
            posts,
            limit,
            offset,
            count: posts.length,
          });
        }

        // POST: Insert new post into Cloudflare D1
        if (request.method === 'POST') {
          const body: any = await request.json();

          const id =
            body.id ||
            (typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `post-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
          const content = body.content ?? body.text ?? '';
          const videoIdRaw = body.video_id ?? body.videoId ?? body.video ?? null;
          const videoId = extractBunnyVideoGuid(videoIdRaw);

          const authorId = body.author_id ?? body.authorId ?? null;
          const authorName = body.author_name ?? body.authorName ?? 'Orthodox Parishioner';
          const authorParish = body.author_parish ?? body.authorParish ?? 'Orthodox Church';
          const authorAvatar =
            body.author_avatar ??
            body.authorAvatar ??
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
          const rawImageUrl = body.image_url ?? body.image ?? null;
          // Clean Media Separation: If post has a video_id, image_url must be null
          const imageUrl = videoId ? null : rawImageUrl;
          const groupId = body.group_id ?? body.groupId ?? null;
          const likesCount =
            typeof body.likes_count === 'number'
              ? body.likes_count
              : typeof body.likesCount === 'number'
              ? body.likesCount
              : 0;
          const commentsCount =
            typeof body.comments_count === 'number'
              ? body.comments_count
              : typeof body.commentsCount === 'number'
              ? body.commentsCount
              : 0;
          const resharesCount =
            typeof body.reshares_count === 'number'
              ? body.reshares_count
              : typeof body.resharesCount === 'number'
              ? body.resharesCount
              : 0;
          const createdAt = body.created_at || body.createdAt || new Date().toISOString();

          const newRow: D1PostRow = {
            id,
            content,
            video_id: videoId,
            author_id: authorId,
            author_name: authorName,
            author_parish: authorParish,
            author_avatar: authorAvatar,
            image_url: imageUrl,
            group_id: groupId,
            likes_count: likesCount,
            comments_count: commentsCount,
            reshares_count: resharesCount,
            created_at: createdAt,
          };

          if (env.DB) {
            const insertSql = `
              INSERT INTO posts (
                id, content, video_id, author_id, author_name, author_parish, author_avatar,
                image_url, group_id, likes_count, comments_count, reshares_count, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await env.DB.prepare(insertSql)
              .bind(
                id,
                content,
                videoId,
                authorId,
                authorName,
                authorParish,
                authorAvatar,
                imageUrl,
                groupId,
                likesCount,
                commentsCount,
                resharesCount,
                createdAt
              )
              .run();
          }

          return jsonResponse({ success: true, post: newRow }, 201);
        }

        return jsonResponse({ success: false, error: `Method ${request.method} not allowed` }, 405);
      }

      // 5. Single post endpoints: /api/posts/:id
      if (url.pathname.startsWith('/api/posts/')) {
        const postId = decodeURIComponent(url.pathname.replace('/api/posts/', '').trim());

        if (!postId) {
          return jsonResponse({ success: false, error: 'Post ID is required' }, 400);
        }

        if (request.method === 'GET') {
          let post: D1PostRow | null = null;
          if (env.DB) {
            post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first<D1PostRow>();
          }

          if (!post) {
            return jsonResponse({ success: false, error: 'Post not found' }, 404);
          }

          return jsonResponse({ success: true, post });
        }

        if (request.method === 'DELETE') {
          const auth = getAuthIdentity(request);

          // Check if post exists to verify author ownership if not admin
          let post: D1PostRow | null = null;
          if (env.DB) {
            try {
              post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first<D1PostRow>();
            } catch (e) {}
          }

          // Permission Rule: Any Admin or Super Admin can delete any post.
          // Regular users can only delete their own posts.
          const isAuthor = Boolean(post && auth.id && post.author_id && auth.id === post.author_id);
          const isAllowed = auth.isAdmin || isAuthor;

          if (post && !isAllowed) {
            return jsonResponse(
              {
                success: false,
                error: 'Forbidden: You do not have permission to delete this post. Only Admins or the post author can delete it.',
              },
              403
            );
          }

          if (env.DB) {
            await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();
          }
          return jsonResponse({ success: true, id: postId, message: 'Post deleted successfully.' });
        }

        return jsonResponse({ success: false, error: `Method ${request.method} not allowed` }, 405);
      }

      // 6. User management endpoints: /api/users/:id
      if (url.pathname.startsWith('/api/users/')) {
        const targetUserId = decodeURIComponent(url.pathname.replace('/api/users/', '').trim());

        if (!targetUserId) {
          return jsonResponse({ success: false, error: 'User ID is required' }, 400);
        }

        if (request.method === 'DELETE') {
          const auth = getAuthIdentity(request);

          // Permission Rule: Any Admin can delete regular user accounts.
          if (!auth.isAdmin) {
            return jsonResponse(
              {
                success: false,
                error: 'Forbidden: Admin access required to delete users.',
              },
              403
            );
          }

          // Check target profile
          let targetProfile: any = null;
          if (env.DB) {
            try {
              targetProfile = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(targetUserId).first();
              if (!targetProfile) {
                targetProfile = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetUserId).first();
              }
            } catch (e) {}
          }

          const targetEmail = (
            targetProfile?.email ||
            url.searchParams.get('target_email') ||
            url.searchParams.get('email') ||
            request.headers.get('x-target-email') ||
            ''
          ).toLowerCase();

          const targetRole = (
            targetProfile?.role ||
            url.searchParams.get('target_role') ||
            url.searchParams.get('role') ||
            request.headers.get('x-target-role') ||
            'user'
          ).toLowerCase();

          // Rule 1: Super Admin account cannot be deleted by anyone
          if (targetEmail === SUPER_ADMIN_EMAIL || targetRole === 'super_admin') {
            return jsonResponse(
              {
                success: false,
                error: 'Forbidden: The Super Admin account cannot be deleted.',
              },
              403
            );
          }

          // Rule 2: NO standard admin can delete another Admin account.
          // ONLY the Super Admin ("orthodoxconnect.live@gmail.com") has permission to delete Admin accounts.
          const isTargetAdmin = targetRole === 'admin' || targetRole === 'owner';
          if (isTargetAdmin && auth.email !== SUPER_ADMIN_EMAIL) {
            return jsonResponse(
              {
                success: false,
                error: 'Forbidden: Only the Super Admin (orthodoxconnect.live@gmail.com) has permission to delete Admin accounts.',
              },
              403
            );
          }

          // Allowed: Execute deletion in D1
          if (env.DB) {
            try {
              await env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(targetUserId).run();
            } catch (e) {}
            try {
              await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId).run();
            } catch (e) {}
            try {
              await env.DB.prepare('DELETE FROM posts WHERE author_id = ?').bind(targetUserId).run();
            } catch (e) {}
          }

          return jsonResponse({
            success: true,
            id: targetUserId,
            message: 'User deleted successfully.',
          });
        }

        return jsonResponse({ success: false, error: `Method ${request.method} not allowed` }, 405);
      }

      return jsonResponse({ success: false, error: 'Endpoint Not Found' }, 404);
    } catch (err: any) {
      console.error('[Cloudflare Worker Error]:', err);
      return jsonResponse(
        {
          success: false,
          error: err?.message || 'Internal Server Error',
        },
        500
      );
    }
  },
};

