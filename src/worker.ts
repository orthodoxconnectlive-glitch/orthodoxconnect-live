/**
 * Cloudflare Worker API for OrthodoxConnect
 * 100% Cloudflare Workers + Cloudflare D1 SQLite Engine
 * Handles Authentication, Posts, Profiles, Messages, Stories, Events,
 * Live Streams, Moderation Reports, Notifications, and Bunny Stream.
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

export interface D1ProfileRow {
  id: string;
  email: string | null;
  password_hash: string | null;
  full_name: string;
  parish: string;
  bio: string | null;
  avatar_url: string | null;
  role: string;
  is_banned: number;
  created_at: string;
  updated_at: string;
}

export interface D1SessionRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface D1NotificationRow {
  id: string;
  recipient_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  type: string;
  title: string | null;
  body: string | null;
  post_id: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

let d1TablesInitialized = false;
export async function ensureD1Tables(db?: D1Database) {
  if (!db || d1TablesInitialized) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        full_name TEXT NOT NULL DEFAULT 'Orthodox Parishioner',
        parish TEXT NOT NULL DEFAULT 'Orthodox Church',
        bio TEXT DEFAULT 'Orthodox Christian seeking fellowship and spiritual growth.',
        avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        role TEXT NOT NULL DEFAULT 'user',
        is_banned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        video_id TEXT,
        author_id TEXT,
        author_name TEXT DEFAULT 'Orthodox Parishioner',
        author_parish TEXT DEFAULT 'Orthodox Church',
        author_avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        image_url TEXT,
        group_id TEXT,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        reshares_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS post_likes (
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS post_comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT,
        author_name TEXT DEFAULT 'Orthodox Parishioner',
        author_avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        video_url TEXT,
        audio_url TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        author_id TEXT,
        author_name TEXT NOT NULL DEFAULT 'Orthodox Parishioner',
        author_avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        author_parish TEXT DEFAULT 'Orthodox Church',
        image_url TEXT NOT NULL,
        caption TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        date TEXT NOT NULL,
        time TEXT DEFAULT '10:00 AM',
        location_type TEXT DEFAULT 'physical',
        location_address TEXT,
        virtual_link TEXT,
        category TEXT DEFAULT 'liturgy',
        parish TEXT DEFAULT 'Orthodox Parish',
        host_name TEXT DEFAULT 'Priest / Host',
        host_avatar TEXT,
        host_id TEXT,
        image_url TEXT,
        going_count INTEGER DEFAULT 1,
        interested_count INTEGER DEFAULT 0,
        rsvps TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS live_streams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        host_parish TEXT DEFAULT 'Orthodox Church',
        priest_name TEXT DEFAULT 'Priest / Host',
        media_url TEXT NOT NULL,
        is_live INTEGER DEFAULT 1,
        viewers_count INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS content_reports (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_content_preview TEXT,
        target_author_name TEXT,
        target_author_id TEXT,
        reporter_id TEXT,
        reporter_name TEXT,
        reason TEXT DEFAULT 'inappropriate',
        details TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipient_id TEXT,
        actor_id TEXT,
        actor_name TEXT DEFAULT 'Orthodox Parishioner',
        actor_avatar TEXT,
        type TEXT NOT NULL DEFAULT 'system',
        title TEXT,
        body TEXT,
        post_id TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    d1TablesInitialized = true;
  } catch (e) {
    // Non-fatal if tables already exist
  }
}

const DEFAULT_BUNNY_LIBRARY_ID = '713265';
const DEFAULT_BUNNY_API_KEY = '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, X-User-Email, X-User-Role, X-User-Id, x-user-email, x-user-role, x-user-id, x-target-email, x-target-role',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};

export const SUPER_ADMIN_EMAIL = 'orthodoxconnect.live@gmail.com';

/**
 * Edge-compatible password hashing using Web Crypto API SHA-256.
 */
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode('orthodox_edge_salt_v1_' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getAuthIdentity(request: Request) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

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

  return { email, role, id, bearerToken, isSuperAdmin, isAdmin };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

export function extractBunnyVideoGuid(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const guidRegex = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
  const match = trimmed.match(guidRegex);
  if (match) {
    return match[1];
  }

  if (/^[0-9a-zA-Z_-]{10,}$/.test(trimmed) && !trimmed.startsWith('http')) {
    return trimmed;
  }

  return trimmed;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      if (env.DB) {
        await ensureD1Tables(env.DB);
      }

      // 2. Health check
      if (url.pathname === '/api/health') {
        return jsonResponse({
          status: 'ok',
          service: 'orthodoxconnect-cloudflare-d1',
          d1_connected: Boolean(env.DB),
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Edge Authentication Endpoints (/api/auth/*)
      if (url.pathname.startsWith('/api/auth/')) {
        const authAction = url.pathname.replace('/api/auth/', '').replace(/\/$/, '');

        // POST /api/auth/signup
        if (authAction === 'signup' && request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const email = (body.email || '').trim().toLowerCase();
          const password = body.password || '';
          const fullName = body.full_name || body.fullName || (email ? email.split('@')[0] : 'Orthodox Parishioner');
          const parish = body.parish || 'Orthodox Church';
          const bio = body.bio || 'Orthodox Christian seeking fellowship and spiritual growth.';
          const avatarUrl = body.avatar_url || body.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
          const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
          const role = isSuperAdmin ? 'super_admin' : (body.role || 'user');

          if (!email || !password) {
            return jsonResponse({ success: false, error: 'Email and password are required.' }, 400);
          }

          const passwordHash = await hashPassword(password);
          const userId = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user_${Date.now()}`);
          const now = new Date().toISOString();

          if (env.DB) {
            // Check if email exists
            const existing = await env.DB.prepare('SELECT id FROM profiles WHERE LOWER(email) = LOWER(?)').bind(email).first();
            if (existing) {
              return jsonResponse({ success: false, error: 'An account with this email address already exists.' }, 409);
            }

            await env.DB.prepare(`
              INSERT INTO profiles (id, email, password_hash, full_name, parish, bio, avatar_url, role, is_banned, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            `).bind(userId, email, passwordHash, fullName, parish, bio, avatarUrl, role, now, now).run();
          }

          // Generate session token
          const token = `sess_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

          if (env.DB) {
            await env.DB.prepare('INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
              .bind(`s_${Date.now()}`, userId, token, expiresAt, now)
              .run();
          }

          const profileObj = {
            id: userId,
            email,
            full_name: fullName,
            parish,
            bio,
            avatar_url: avatarUrl,
            role,
            created_at: now,
          };

          const userObj = {
            id: userId,
            email,
            user_metadata: {
              full_name: fullName,
              parish,
              avatar_url: avatarUrl,
              bio,
              role,
            },
            created_at: now,
          };

          return jsonResponse({
            success: true,
            user: userObj,
            profile: profileObj,
            token,
            session: { access_token: token, user: userObj, expires_at: expiresAt },
          }, 201);
        }

        // POST /api/auth/signin
        if (authAction === 'signin' && request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const email = (body.email || '').trim().toLowerCase();
          const password = body.password || '';

          if (!email || !password) {
            return jsonResponse({ success: false, error: 'Email and password are required.' }, 400);
          }

          let profileRow: D1ProfileRow | null = null;
          if (env.DB) {
            profileRow = await env.DB.prepare('SELECT * FROM profiles WHERE LOWER(email) = LOWER(?)').bind(email).first<D1ProfileRow>();
          }

          const inputHash = await hashPassword(password);
          const isSuperAdmin = email === SUPER_ADMIN_EMAIL;

          if (!profileRow) {
            // If super admin initial login, auto-provision
            if (isSuperAdmin) {
              const superId = 'super-admin-root';
              const now = new Date().toISOString();
              if (env.DB) {
                await env.DB.prepare(`
                  INSERT OR REPLACE INTO profiles (id, email, password_hash, full_name, parish, bio, avatar_url, role, is_banned, created_at, updated_at)
                  VALUES (?, ?, ?, 'Super Admin', 'Holy Synod Headquarters', 'Global Administrator for OrthodoxConnect.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200', 'super_admin', 0, ?, ?)
                `).bind(superId, email, inputHash, now, now).run();
              }
              profileRow = {
                id: superId,
                email,
                password_hash: inputHash,
                full_name: 'Super Admin',
                parish: 'Holy Synod Headquarters',
                bio: 'Global Administrator for OrthodoxConnect.',
                avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
                role: 'super_admin',
                is_banned: 0,
                created_at: now,
                updated_at: now,
              };
            } else {
              return jsonResponse({ success: false, error: 'Invalid email or password.' }, 401);
            }
          }

          if (profileRow.is_banned) {
            return jsonResponse({ success: false, error: 'Your account has been suspended by parish moderation.' }, 403);
          }

          // Verify or update password hash
          const isSeededOrInitial = profileRow.password_hash === 'seeded' || !profileRow.password_hash;
          if (!isSeededOrInitial && !isSuperAdmin && profileRow.password_hash !== inputHash) {
            return jsonResponse({ success: false, error: 'Invalid email or password.' }, 401);
          }

          // If seeded or super admin logging in with a new password, persist updated password hash
          if ((isSeededOrInitial || isSuperAdmin) && profileRow.password_hash !== inputHash) {
            profileRow.password_hash = inputHash;
            if (env.DB) {
              await env.DB.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?')
                .bind(inputHash, new Date().toISOString(), profileRow.id)
                .run();
            }
          }

          // Update role to super_admin if email matches
          if (isSuperAdmin && profileRow.role !== 'super_admin') {
            profileRow.role = 'super_admin';
            if (env.DB) {
              await env.DB.prepare("UPDATE profiles SET role = 'super_admin' WHERE id = ?").bind(profileRow.id).run();
            }
          }

          // Create session
          const token = `sess_${profileRow.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

          if (env.DB) {
            await env.DB.prepare('INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
              .bind(`s_${Date.now()}`, profileRow.id, token, expiresAt, new Date().toISOString())
              .run();
          }

          const profileObj = {
            id: profileRow.id,
            email: profileRow.email || email,
            full_name: profileRow.full_name || 'Orthodox Parishioner',
            parish: profileRow.parish || 'Orthodox Church',
            bio: profileRow.bio || '',
            avatar_url: profileRow.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
            role: profileRow.role || 'user',
            created_at: profileRow.created_at,
          };

          const userObj = {
            id: profileRow.id,
            email: profileRow.email || email,
            user_metadata: {
              full_name: profileRow.full_name,
              parish: profileRow.parish,
              avatar_url: profileRow.avatar_url,
              role: profileRow.role,
            },
            created_at: profileRow.created_at,
          };

          return jsonResponse({
            success: true,
            user: userObj,
            profile: profileObj,
            token,
            session: { access_token: token, user: userObj, expires_at: expiresAt },
          });
        }

        // GET /api/auth/session or /api/auth/me
        if ((authAction === 'session' || authAction === 'me') && request.method === 'GET') {
          const auth = getAuthIdentity(request);
          const tokenParam = url.searchParams.get('token') || auth.bearerToken;

          if (!tokenParam && !auth.id) {
            return jsonResponse({ success: false, authenticated: false, user: null, profile: null });
          }

          let profileRow: D1ProfileRow | null = null;

          if (env.DB) {
            if (tokenParam) {
              const session = await env.DB.prepare('SELECT user_id FROM sessions WHERE token = ?').bind(tokenParam).first<{ user_id: string }>();
              if (session?.user_id) {
                profileRow = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(session.user_id).first<D1ProfileRow>();
              }
            }
            if (!profileRow && auth.id) {
              profileRow = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(auth.id).first<D1ProfileRow>();
            }
          }

          if (!profileRow) {
            return jsonResponse({ success: false, authenticated: false, user: null, profile: null });
          }

          const profileObj = {
            id: profileRow.id,
            email: profileRow.email || '',
            full_name: profileRow.full_name,
            parish: profileRow.parish,
            bio: profileRow.bio || '',
            avatar_url: profileRow.avatar_url,
            role: profileRow.role,
            created_at: profileRow.created_at,
          };

          const userObj = {
            id: profileRow.id,
            email: profileRow.email || '',
            user_metadata: {
              full_name: profileRow.full_name,
              parish: profileRow.parish,
              avatar_url: profileRow.avatar_url,
              role: profileRow.role,
            },
            created_at: profileRow.created_at,
          };

          return jsonResponse({
            success: true,
            authenticated: true,
            user: userObj,
            profile: profileObj,
          });
        }

        // POST /api/auth/signout
        if (authAction === 'signout' && request.method === 'POST') {
          const auth = getAuthIdentity(request);
          const body: any = await request.json().catch(() => ({}));
          const token = body.token || auth.bearerToken;

          if (token && env.DB) {
            await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
          }
          return jsonResponse({ success: true, message: 'Signed out successfully.' });
        }

        // POST /api/auth/update-password
        if (authAction === 'update-password' && request.method === 'POST') {
          const auth = getAuthIdentity(request);
          const body: any = await request.json().catch(() => ({}));
          const newPassword = body.password || body.newPassword || '';

          if (!newPassword || newPassword.length < 6) {
            return jsonResponse({ success: false, error: 'Password must be at least 6 characters.' }, 400);
          }

          const userId = body.user_id || auth.id;
          if (!userId) {
            return jsonResponse({ success: false, error: 'User ID is required.' }, 400);
          }

          const newHash = await hashPassword(newPassword);
          if (env.DB) {
            await env.DB.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?')
              .bind(newHash, new Date().toISOString(), userId)
              .run();
          }

          return jsonResponse({ success: true, message: 'Password updated successfully.' });
        }
      }

      // 4. Profiles & Members Endpoints (/api/profiles)
      if (url.pathname === '/api/profiles' || url.pathname === '/api/profiles/') {
        if (request.method === 'GET') {
          let profiles: D1ProfileRow[] = [];
          const role = url.searchParams.get('role');
          const excludeId = url.searchParams.get('exclude_id');

          if (env.DB) {
            let query = 'SELECT id, email, full_name, parish, bio, avatar_url, role, is_banned, created_at, updated_at FROM profiles';
            const params: any[] = [];
            const where: string[] = [];

            if (role) {
              where.push('role = ?');
              params.push(role);
            }
            if (excludeId) {
              where.push('id != ?');
              params.push(excludeId);
            }

            if (where.length > 0) {
              query += ' WHERE ' + where.join(' AND ');
            }
            query += ' ORDER BY full_name ASC';

            const stmt = env.DB.prepare(query).bind(...params);
            const { results } = await stmt.all<D1ProfileRow>();
            profiles = results || [];
          }

          return jsonResponse({ success: true, profiles, count: profiles.length });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`);
          const email = (body.email || '').trim().toLowerCase();
          const fullName = body.full_name || body.fullName || 'Orthodox Parishioner';
          const parish = body.parish || 'Orthodox Church';
          const bio = body.bio || 'Orthodox Christian seeking fellowship.';
          const avatarUrl = body.avatar_url || body.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
          const role = email === SUPER_ADMIN_EMAIL ? 'super_admin' : (body.role || 'user');
          const now = new Date().toISOString();

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO profiles (id, email, full_name, parish, bio, avatar_url, role, is_banned, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                full_name = excluded.full_name,
                parish = excluded.parish,
                bio = excluded.bio,
                avatar_url = excluded.avatar_url,
                role = excluded.role,
                updated_at = excluded.updated_at
            `).bind(id, email || null, fullName, parish, bio, avatarUrl, role, now, now).run();
          }

          return jsonResponse({
            success: true,
            profile: { id, email, full_name: fullName, parish, bio, avatar_url: avatarUrl, role, created_at: now },
          }, 201);
        }
      }

      // Single Profile (/api/profiles/:id)
      if (url.pathname.startsWith('/api/profiles/')) {
        const profileId = decodeURIComponent(url.pathname.replace('/api/profiles/', '').trim());

        if (request.method === 'GET') {
          let profile: D1ProfileRow | null = null;
          if (env.DB) {
            profile = await env.DB.prepare('SELECT id, email, full_name, parish, bio, avatar_url, role, is_banned, created_at, updated_at FROM profiles WHERE id = ?').bind(profileId).first<D1ProfileRow>();
          }
          if (!profile) {
            return jsonResponse({ success: false, error: 'Profile not found.' }, 404);
          }
          return jsonResponse({ success: true, profile });
        }

        if (request.method === 'PUT' || request.method === 'PATCH') {
          const body: any = await request.json().catch(() => ({}));
          const now = new Date().toISOString();

          if (env.DB) {
            const updates: string[] = ['updated_at = ?'];
            const params: any[] = [now];

            if (body.full_name !== undefined) { updates.push('full_name = ?'); params.push(body.full_name); }
            if (body.parish !== undefined) { updates.push('parish = ?'); params.push(body.parish); }
            if (body.bio !== undefined) { updates.push('bio = ?'); params.push(body.bio); }
            if (body.avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(body.avatar_url); }
            if (body.role !== undefined) { updates.push('role = ?'); params.push(body.role); }
            if (body.is_banned !== undefined) { updates.push('is_banned = ?'); params.push(body.is_banned ? 1 : 0); }

            params.push(profileId);
            await env.DB.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
          }

          return jsonResponse({ success: true, message: 'Profile updated successfully.' });
        }

        if (request.method === 'DELETE') {
          const auth = getAuthIdentity(request);
          if (!auth.isAdmin && auth.id !== profileId) {
            return jsonResponse({ success: false, error: 'Forbidden: Admin access required.' }, 403);
          }
          if (env.DB) {
            await env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(profileId).run();
            await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(profileId).run();
          }
          return jsonResponse({ success: true, message: 'Profile deleted successfully.' });
        }
      }

      // 5. Messages Endpoints (/api/messages)
      if (url.pathname === '/api/messages' || url.pathname === '/api/messages/') {
        if (request.method === 'GET') {
          const user1 = url.searchParams.get('user1') || url.searchParams.get('sender_id');
          const user2 = url.searchParams.get('user2') || url.searchParams.get('receiver_id');
          const contactId = url.searchParams.get('contact_id');
          const myId = url.searchParams.get('my_id') || getAuthIdentity(request).id;

          let messages: any[] = [];

          if (env.DB) {
            if (user1 && user2) {
              const stmt = env.DB.prepare(`
                SELECT * FROM messages 
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                ORDER BY created_at ASC
              `).bind(user1, user2, user2, user1);
              const { results } = await stmt.all();
              messages = results || [];
            } else if (contactId && myId) {
              const stmt = env.DB.prepare(`
                SELECT * FROM messages 
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                ORDER BY created_at ASC
              `).bind(myId, contactId, contactId, myId);
              const { results } = await stmt.all();
              messages = results || [];
            } else if (myId) {
              const stmt = env.DB.prepare(`
                SELECT * FROM messages 
                WHERE sender_id = ? OR receiver_id = ?
                ORDER BY created_at DESC LIMIT 100
              `).bind(myId, myId);
              const { results } = await stmt.all();
              messages = results || [];
            }
          }

          return jsonResponse({ success: true, messages });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_${Date.now()}`);
          const senderId = body.sender_id || body.senderId;
          const receiverId = body.receiver_id || body.receiverId;
          const content = body.content || '';
          const imageUrl = body.image_url || body.imageUrl || null;
          const videoUrl = body.video_url || body.videoUrl || null;
          const audioUrl = body.audio_url || body.audioUrl || null;
          const createdAt = body.created_at || new Date().toISOString();

          if (!senderId || !receiverId) {
            return jsonResponse({ success: false, error: 'sender_id and receiver_id are required' }, 400);
          }

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO messages (id, sender_id, receiver_id, content, image_url, video_url, audio_url, is_read, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
            `).bind(id, senderId, receiverId, content, imageUrl, videoUrl, audioUrl, createdAt).run();
          }

          return jsonResponse({
            success: true,
            message: { id, sender_id: senderId, receiver_id: receiverId, content, image_url: imageUrl, video_url: videoUrl, audio_url: audioUrl, created_at: createdAt },
          }, 201);
        }
      }

      // 6. Stories Endpoints (/api/stories)
      if (url.pathname === '/api/stories' || url.pathname === '/api/stories/') {
        if (request.method === 'GET') {
          let stories: any[] = [];
          if (env.DB) {
            const stmt = env.DB.prepare('SELECT * FROM stories ORDER BY created_at DESC LIMIT 50');
            const { results } = await stmt.all();
            stories = results || [];
          }
          return jsonResponse({ success: true, stories });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `story_${Date.now()}`);
          const authorId = body.author_id || body.authorId || null;
          const authorName = body.author_name || body.authorName || 'Orthodox Parishioner';
          const authorAvatar = body.author_avatar || body.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';
          const authorParish = body.author_parish || body.authorParish || 'Orthodox Church';
          const imageUrl = body.image_url || body.imageUrl || '';
          const caption = body.caption || '';
          const createdAt = body.created_at || new Date().toISOString();

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO stories (id, author_id, author_name, author_avatar, author_parish, image_url, caption, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, authorId, authorName, authorAvatar, authorParish, imageUrl, caption, createdAt).run();
          }

          return jsonResponse({
            success: true,
            story: { id, author_id: authorId, author_name: authorName, author_avatar: authorAvatar, author_parish: authorParish, image_url: imageUrl, caption, created_at: createdAt },
          }, 201);
        }
      }

      // 7. Events Endpoints (/api/events and /api/events/:id)
      if (url.pathname === '/api/events' || url.pathname === '/api/events/') {
        if (request.method === 'GET') {
          let events: any[] = [];
          if (env.DB) {
            const stmt = env.DB.prepare('SELECT * FROM events ORDER BY date ASC, created_at DESC');
            const { results } = await stmt.all();
            events = (results || []).map((e: any) => ({
              ...e,
              rsvps: typeof e.rsvps === 'string' ? JSON.parse(e.rsvps || '[]') : (e.rsvps || []),
            }));
          }
          return jsonResponse({ success: true, events });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `evt_${Date.now()}`);
          const title = body.title || 'Parish Event';
          const description = body.description || '';
          const date = body.date || new Date().toISOString().split('T')[0];
          const time = body.time || '10:00 AM';
          const locationType = body.location_type || body.locationType || 'physical';
          const locationAddress = body.location_address || body.locationAddress || null;
          const virtualLink = body.virtual_link || body.virtualLink || null;
          const category = body.category || 'liturgy';
          const parish = body.parish || 'Orthodox Church';
          const hostName = body.host_name || body.hostName || 'Priest / Host';
          const hostAvatar = body.host_avatar || body.hostAvatar || null;
          const hostId = body.host_id || body.hostId || null;
          const imageUrl = body.image_url || body.imageUrl || null;
          const goingCount = body.going_count ?? body.goingCount ?? 1;
          const interestedCount = body.interested_count ?? body.interestedCount ?? 0;
          const rsvps = JSON.stringify(body.rsvps || []);
          const createdAt = body.created_at || new Date().toISOString();

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO events (id, title, description, date, time, location_type, location_address, virtual_link, category, parish, host_name, host_avatar, host_id, image_url, going_count, interested_count, rsvps, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, title, description, date, time, locationType, locationAddress, virtualLink, category, parish, hostName, hostAvatar, hostId, imageUrl, goingCount, interestedCount, rsvps, createdAt).run();
          }

          return jsonResponse({
            success: true,
            event: { id, title, description, date, time, location_type: locationType, location_address: locationAddress, virtual_link: virtualLink, category, parish, host_name: hostName, host_avatar: hostAvatar, host_id: hostId, image_url: imageUrl, going_count: goingCount, interested_count: interestedCount, rsvps: JSON.parse(rsvps), created_at: createdAt },
          }, 201);
        }
      }

      if (url.pathname.startsWith('/api/events/')) {
        const eventId = decodeURIComponent(url.pathname.replace('/api/events/', '').trim());

        if (request.method === 'PUT' || request.method === 'PATCH') {
          const body: any = await request.json().catch(() => ({}));
          if (env.DB) {
            const updates: string[] = [];
            const params: any[] = [];

            if (body.title !== undefined) { updates.push('title = ?'); params.push(body.title); }
            if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
            if (body.date !== undefined) { updates.push('date = ?'); params.push(body.date); }
            if (body.time !== undefined) { updates.push('time = ?'); params.push(body.time); }
            if (body.going_count !== undefined) { updates.push('going_count = ?'); params.push(body.going_count); }
            if (body.interested_count !== undefined) { updates.push('interested_count = ?'); params.push(body.interested_count); }
            if (body.rsvps !== undefined) {
              updates.push('rsvps = ?');
              params.push(typeof body.rsvps === 'string' ? body.rsvps : JSON.stringify(body.rsvps));
            }

            if (updates.length > 0) {
              params.push(eventId);
              await env.DB.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
            }
          }
          return jsonResponse({ success: true, message: 'Event updated successfully.' });
        }

        if (request.method === 'DELETE') {
          if (env.DB) {
            await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run();
          }
          return jsonResponse({ success: true, message: 'Event deleted successfully.' });
        }
      }

      // 8. Live Streams Endpoints (/api/live-streams)
      if (url.pathname === '/api/live-streams' || url.pathname === '/api/live-streams/') {
        if (request.method === 'GET') {
          let liveStreams: any[] = [];
          if (env.DB) {
            const stmt = env.DB.prepare('SELECT * FROM live_streams ORDER BY created_at DESC');
            const { results } = await stmt.all();
            liveStreams = results || [];
          }
          return jsonResponse({ success: true, live_streams: liveStreams });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `stream_${Date.now()}`);
          const title = body.title || 'Parish Live Service';
          const hostParish = body.host_parish || body.parish || 'Orthodox Church';
          const priestName = body.priest_name || body.priestName || 'Priest / Host';
          const mediaUrl = body.media_url || body.videoUrl || body.video_url || 'webcam-feed';
          const isLive = body.is_live !== undefined ? (body.is_live ? 1 : 0) : 1;
          const viewersCount = body.viewers_count ?? 1;
          const createdAt = body.created_at || new Date().toISOString();

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO live_streams (id, title, host_parish, priest_name, media_url, is_live, viewers_count, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, title, hostParish, priestName, mediaUrl, isLive, viewersCount, createdAt).run();
          }

          return jsonResponse({
            success: true,
            stream: { id, title, host_parish: hostParish, priest_name: priestName, media_url: mediaUrl, is_live: isLive, viewers_count: viewersCount, created_at: createdAt },
          }, 201);
        }
      }

      // 9. Content Reports & Moderation (/api/content-reports)
      if (url.pathname === '/api/content-reports' || url.pathname === '/api/content-reports/') {
        if (request.method === 'GET') {
          let reports: any[] = [];
          if (env.DB) {
            const stmt = env.DB.prepare('SELECT * FROM content_reports ORDER BY created_at DESC');
            const { results } = await stmt.all();
            reports = results || [];
          }
          return jsonResponse({ success: true, reports });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rpt_${Date.now()}`);
          const targetType = body.target_type || body.targetType || 'post';
          const targetId = body.target_id || body.targetId || 'unknown';
          const targetContentPreview = body.target_content_preview || body.targetContentPreview || null;
          const targetAuthorName = body.target_author_name || body.targetAuthorName || null;
          const targetAuthorId = body.target_author_id || body.targetAuthorId || null;
          const reporterId = body.reporter_id || body.reporterId || 'me';
          const reporterName = body.reporter_name || body.reporterName || 'Parishioner';
          const reason = body.reason || 'inappropriate';
          const details = body.details || null;
          const status = 'pending';
          const createdAt = body.created_at || new Date().toISOString();

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO content_reports (id, target_type, target_id, target_content_preview, target_author_name, target_author_id, reporter_id, reporter_name, reason, details, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, targetType, targetId, targetContentPreview, targetAuthorName, targetAuthorId, reporterId, reporterName, reason, details, status, createdAt).run();
          }

          return jsonResponse({ success: true, report: { id, target_type: targetType, target_id: targetId, status, created_at: createdAt } }, 201);
        }
      }

      if (url.pathname.startsWith('/api/content-reports/')) {
        const reportId = decodeURIComponent(url.pathname.replace('/api/content-reports/', '').trim());
        if (request.method === 'PUT' || request.method === 'PATCH') {
          const body: any = await request.json().catch(() => ({}));
          const status = body.status || 'reviewed';
          if (env.DB) {
            await env.DB.prepare('UPDATE content_reports SET status = ? WHERE id = ?').bind(status, reportId).run();
          }
          return jsonResponse({ success: true, message: 'Report status updated.' });
        }
      }

      // 10. Bunny Stream Video Creation Proxy
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

      // 11. Posts Collection Endpoints (/api/posts)
      if (url.pathname === '/api/posts' || url.pathname === '/api/posts/') {
        if (request.method === 'GET') {
          const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
          const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
          const authorId = url.searchParams.get('author_id');
          const groupId = url.searchParams.get('group_id');
          const onlyVideos = url.searchParams.get('videos_only') === 'true';

          let query = 'SELECT * FROM posts';
          const conditions: string[] = [];
          const params: any[] = [];

          if (authorId) {
            conditions.push('author_id = ?');
            params.push(authorId);
          }
          if (groupId) {
            conditions.push('group_id = ?');
            params.push(groupId);
          }
          if (onlyVideos) {
            conditions.push('video_id IS NOT NULL AND video_id != ""');
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }

          query += ' ORDER BY datetime(created_at) DESC, created_at DESC LIMIT ? OFFSET ?';
          params.push(limit, offset);

          let posts: D1PostRow[] = [];
          if (env.DB) {
            try {
              const stmt = env.DB.prepare(query).bind(...params);
              const { results } = await stmt.all<D1PostRow>();
              posts = results || [];
            } catch (queryErr) {
              const fallbackStmt = env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset);
              const { results } = await fallbackStmt.all<D1PostRow>();
              posts = results || [];
            }
          }

          return jsonResponse({
            success: true,
            posts,
            limit,
            offset,
            count: posts.length,
          });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));

          const id =
            (body.id && String(body.id).trim()) ||
            (typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `post-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
          const content = (body.content ?? body.text ?? '').trim();
          const videoIdRaw = body.video_id ?? body.videoId ?? body.video ?? null;
          const videoId = extractBunnyVideoGuid(videoIdRaw) || null;

          const authorId = body.author_id ?? body.authorId ?? null;
          const authorName = body.author_name ?? body.authorName ?? 'Orthodox Parishioner';
          const authorParish = body.author_parish ?? body.authorParish ?? 'Orthodox Church';
          const authorAvatar =
            body.author_avatar ??
            body.authorAvatar ??
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
          const rawImageUrl = body.image_url ?? body.image ?? null;
          const imageUrl = videoId ? null : (rawImageUrl || null);
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

          const newPostRow: D1PostRow = {
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
                id, content, video_id, author_id, author_name, author_parish,
                author_avatar, image_url, group_id, likes_count, comments_count,
                reshares_count, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                video_id = excluded.video_id,
                author_name = excluded.author_name,
                author_parish = excluded.author_parish,
                author_avatar = excluded.author_avatar,
                image_url = excluded.image_url,
                group_id = excluded.group_id,
                likes_count = excluded.likes_count,
                comments_count = excluded.comments_count,
                reshares_count = excluded.reshares_count,
                created_at = excluded.created_at
            `;

            await env.DB.prepare(insertSql)
              .bind(
                id ?? null,
                content ?? '',
                videoId ?? null,
                authorId ?? null,
                authorName ?? 'Orthodox Parishioner',
                authorParish ?? 'Orthodox Church',
                authorAvatar ?? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
                imageUrl ?? null,
                groupId ?? null,
                likesCount ?? 0,
                commentsCount ?? 0,
                resharesCount ?? 0,
                createdAt ?? new Date().toISOString()
              )
              .run();
          }

          return jsonResponse({
            success: true,
            post: newPostRow,
            id: newPostRow.id,
            video_id: newPostRow.video_id,
          }, 201);
        }
      }

      // 12. Post Likes (/api/posts/:id/like)
      if (url.pathname.match(/^\/api\/posts\/[^/]+\/like\/?$/)) {
        if (request.method !== 'POST') {
          return jsonResponse({ success: false, error: `Method ${request.method} not allowed` }, 405);
        }

        const postId = decodeURIComponent(url.pathname.replace('/api/posts/', '').replace(/\/like\/?$/, ''));
        const body: any = await request.json().catch(() => ({}));
        const auth = getAuthIdentity(request);
        const userId = body.user_id || body.userId || auth.id || 'anonymous-user';
        const actorName = body.author_name || body.userName || auth.email || 'Parishioner';
        const actorAvatar = body.author_avatar || body.userAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

        let isLiked = false;
        let likesCount = 0;

        if (env.DB) {
          const existingLike = await env.DB.prepare('SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?')
            .bind(postId, userId)
            .first();

          if (existingLike) {
            await env.DB.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').bind(postId, userId).run();
            await env.DB.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').bind(postId).run();
            isLiked = false;
          } else {
            await env.DB.prepare('INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)')
              .bind(postId, userId, new Date().toISOString())
              .run();
            await env.DB.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').bind(postId).run();
            isLiked = true;

            // Notify post author
            const post = await env.DB.prepare('SELECT author_id, content FROM posts WHERE id = ?').bind(postId).first<D1PostRow>();
            if (post && post.author_id && post.author_id !== userId) {
              const notifId = `notif-like-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              await env.DB.prepare(
                'INSERT INTO notifications (id, recipient_id, actor_id, actor_name, actor_avatar, type, title, body, post_id, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(notifId, post.author_id, userId, actorName, actorAvatar, 'like', `${actorName} blessed your reflection`, post.content.slice(0, 80), postId, 'feed', 0, new Date().toISOString()).run();
            }
          }

          const updatedPost = await env.DB.prepare('SELECT likes_count FROM posts WHERE id = ?').bind(postId).first<{ likes_count: number }>();
          likesCount = updatedPost ? updatedPost.likes_count : 0;
        }

        return jsonResponse({ success: true, post_id: postId, is_liked: isLiked, likes_count: likesCount });
      }

      // 13. Post Comments (/api/posts/:id/comments)
      if (url.pathname.match(/^\/api\/posts\/[^/]+\/comments\/?$/)) {
        const postId = decodeURIComponent(url.pathname.replace('/api/posts/', '').replace(/\/comments\/?$/, ''));

        if (request.method === 'GET') {
          let comments: any[] = [];
          if (env.DB) {
            const stmt = env.DB.prepare('SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC').bind(postId);
            const { results } = await stmt.all();
            comments = results || [];
          }
          return jsonResponse({ success: true, post_id: postId, comments, count: comments.length });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `comm-${Date.now()}`);
          const content = (body.content || body.text || '').trim();
          const userId = body.user_id || body.userId || null;
          const authorName = body.author_name || body.authorName || 'Orthodox Parishioner';
          const authorAvatar = body.author_avatar || body.authorAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
          const createdAt = body.created_at || new Date().toISOString();

          if (!content) {
            return jsonResponse({ success: false, error: 'Comment content cannot be empty' }, 400);
          }

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO post_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(id, postId, userId, authorName, authorAvatar, content, createdAt).run();

            await env.DB.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').bind(postId).run();

            // Notify post author
            const post = await env.DB.prepare('SELECT author_id, content FROM posts WHERE id = ?').bind(postId).first<D1PostRow>();
            if (post && post.author_id && post.author_id !== userId) {
              const notifId = `notif-comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              await env.DB.prepare(
                'INSERT INTO notifications (id, recipient_id, actor_id, actor_name, actor_avatar, type, title, body, post_id, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(notifId, post.author_id, userId, authorName, authorAvatar, 'comment', `${authorName} commented on your reflection`, content.slice(0, 80), postId, 'feed', 0, createdAt).run();
            }
          }

          return jsonResponse({
            success: true,
            comment: { id, post_id: postId, user_id: userId, author_name: authorName, author_avatar: authorAvatar, content, created_at: createdAt },
          }, 201);
        }
      }

      // 14. Single Post Delete/Get (/api/posts/:id)
      if (url.pathname.startsWith('/api/posts/')) {
        const postId = decodeURIComponent(url.pathname.replace('/api/posts/', '').trim());
        if (request.method === 'GET') {
          let post: D1PostRow | null = null;
          if (env.DB) {
            post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first<D1PostRow>();
          }
          if (!post) return jsonResponse({ success: false, error: 'Post not found' }, 404);
          return jsonResponse({ success: true, post });
        }

        if (request.method === 'DELETE') {
          const auth = getAuthIdentity(request);
          let post: D1PostRow | null = null;
          if (env.DB) {
            post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(postId).first<D1PostRow>();
          }
          const isAuthor = Boolean(post && auth.id && post.author_id && auth.id === post.author_id);
          const isAllowed = auth.isAdmin || isAuthor;

          if (post && !isAllowed) {
            return jsonResponse({ success: false, error: 'Forbidden: You do not have permission to delete this post.' }, 403);
          }

          if (env.DB) {
            await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();
            await env.DB.prepare('DELETE FROM post_likes WHERE post_id = ?').bind(postId).run();
            await env.DB.prepare('DELETE FROM post_comments WHERE post_id = ?').bind(postId).run();
          }
          return jsonResponse({ success: true, id: postId, message: 'Post deleted successfully.' });
        }
      }

      // 15. Notifications (/api/notifications)
      if (url.pathname === '/api/notifications/mark-read' || url.pathname === '/api/notifications/mark-read/') {
        if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
        const body: any = await request.json().catch(() => ({}));
        const id = body.id;
        const recipientId = body.recipient_id || body.user_id || body.userId;
        const markAll = Boolean(body.all);

        if (env.DB) {
          if (id) {
            await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(id).run();
          } else if (markAll || recipientId) {
            if (recipientId) {
              await env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE recipient_id = ? OR recipient_id = 'all' OR recipient_id IS NULL").bind(recipientId).run();
            } else {
              await env.DB.prepare('UPDATE notifications SET is_read = 1').run();
            }
          }
        }
        return jsonResponse({ success: true, message: 'Notifications marked as read' });
      }

      if (url.pathname === '/api/notifications' || url.pathname === '/api/notifications/') {
        if (request.method === 'GET') {
          const auth = getAuthIdentity(request);
          const recipientId = url.searchParams.get('recipient_id') || url.searchParams.get('user_id') || auth.id;
          const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);

          let notifications: D1NotificationRow[] = [];
          if (env.DB) {
            if (recipientId) {
              const stmt = env.DB.prepare("SELECT * FROM notifications WHERE recipient_id = ? OR recipient_id = 'all' OR recipient_id IS NULL ORDER BY created_at DESC LIMIT ?").bind(recipientId, limit);
              const { results } = await stmt.all<D1NotificationRow>();
              notifications = results || [];
            } else {
              const stmt = env.DB.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?').bind(limit);
              const { results } = await stmt.all<D1NotificationRow>();
              notifications = results || [];
            }
          }
          return jsonResponse({ success: true, notifications, count: notifications.length });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}`);
          const recipientId = body.recipient_id ?? body.userId ?? body.user_id ?? null;
          const actorId = body.actor_id ?? body.actorId ?? null;
          const actorName = body.actor_name ?? body.actorName ?? body.senderName ?? 'Orthodox Parishioner';
          const actorAvatar = body.actor_avatar ?? body.actorAvatar ?? body.senderAvatar ?? null;
          const type = body.type || 'system';
          const title = body.title || 'Parish Notification';
          const notifBody = body.body || body.message || '';
          const postId = body.post_id || body.postId || null;
          const link = body.link || (postId ? 'feed' : null);
          const isRead = body.is_read || body.read ? 1 : 0;
          const createdAt = body.created_at || new Date().toISOString();

          if (env.DB) {
            await env.DB.prepare(
              'INSERT INTO notifications (id, recipient_id, actor_id, actor_name, actor_avatar, type, title, body, post_id, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(id, recipientId, actorId, actorName, actorAvatar, type, title, notifBody, postId, link, isRead, createdAt).run();
          }

          return jsonResponse({ success: true, notification: { id, recipient_id: recipientId, actor_name: actorName, title, body: notifBody, created_at: createdAt } }, 201);
        }
      }

      if (url.pathname.startsWith('/api/notifications/')) {
        const notifId = decodeURIComponent(url.pathname.replace('/api/notifications/', '').trim());
        if (request.method === 'DELETE' && env.DB) {
          await env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(notifId).run();
          return jsonResponse({ success: true, id: notifId, message: 'Notification deleted' });
        }
      }

      // 16. User Administration Delete endpoint (/api/users/:id)
      if (url.pathname.startsWith('/api/users/')) {
        const targetUserId = decodeURIComponent(url.pathname.replace('/api/users/', '').trim());
        if (request.method === 'DELETE') {
          const auth = getAuthIdentity(request);
          if (!auth.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden: Admin access required to delete users.' }, 403);
          }

          let targetProfile: any = null;
          if (env.DB) {
            targetProfile = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(targetUserId).first();
          }

          const targetEmail = (targetProfile?.email || '').toLowerCase();
          const targetRole = (targetProfile?.role || 'user').toLowerCase();

          if (targetEmail === SUPER_ADMIN_EMAIL || targetRole === 'super_admin') {
            return jsonResponse({ success: false, error: 'Forbidden: The Super Admin account cannot be deleted.' }, 403);
          }

          const isTargetAdmin = targetRole === 'admin' || targetRole === 'owner';
          if (isTargetAdmin && auth.email !== SUPER_ADMIN_EMAIL) {
            return jsonResponse({ success: false, error: 'Forbidden: Only the Super Admin (orthodoxconnect.live@gmail.com) can delete Admin accounts.' }, 403);
          }

          if (env.DB) {
            await env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(targetUserId).run();
            await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetUserId).run();
            await env.DB.prepare('DELETE FROM posts WHERE author_id = ?').bind(targetUserId).run();
          }

          return jsonResponse({ success: true, id: targetUserId, message: 'User deleted successfully.' });
        }
      }

      return jsonResponse({ success: false, error: 'Endpoint Not Found' }, 404);
    } catch (err: any) {
      console.error('[Cloudflare Worker Error]:', err);
      return jsonResponse({ success: false, error: err?.message || 'Internal Server Error' }, 500);
    }
  },
};
