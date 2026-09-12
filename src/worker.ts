/**
 * Cloudflare Worker API for OrthodoxConnect
 * 100% Cloudflare Workers + Cloudflare D1 SQLite Engine
 * Handles Authentication, Posts, Profiles, Messages, Stories, Events,
 * Live Streams, Moderation Reports, Notifications, Bunny Stream, and Books Library.
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
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
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

export interface D1BookRow {
  id: string;
  title_ar: string;
  title_en: string | null;
  author_ar: string;
  author_en: string | null;
  category: string;
  cover_image_url: string | null;
  file_url: string;
  description: string | null;
  created_at: string;
}

let d1TablesInitialized = false;
export async function ensureD1Tables(db?: D1Database) {
  if (!db || d1TablesInitialized) return;
  // Standalone churches table creation — runs before the legacy giant batch,
  // which is non-fatal and may throw (its catch would otherwise skip this).
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS churches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT DEFAULT '',
        cover TEXT DEFAULT '',
        description TEXT DEFAULT '',
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT '',
        priest_name TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        website TEXT DEFAULT '',
        service_times TEXT DEFAULT '',
        owner_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  } catch (churchTblErr) {
    console.warn('[ensureD1Tables] churches table notice:', churchTblErr);
  }
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
        user_name TEXT,
        user_avatar TEXT,
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
        sender_name TEXT,
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
        media_type TEXT DEFAULT 'image',
        caption TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS churches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT DEFAULT '',
        cover TEXT DEFAULT '',
        description TEXT DEFAULT '',
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT '',
        priest_name TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        website TEXT DEFAULT '',
        service_times TEXT DEFAULT '',
        owner_id TEXT,
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
        ended_at TEXT,
        replay_guid TEXT,
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

      CREATE TABLE IF NOT EXISTS call_signals (
        id TEXT PRIMARY KEY,
        call_id TEXT,
        sig_type TEXT,
        caller_id TEXT,
        caller_name TEXT,
        caller_avatar TEXT,
        target_user_id TEXT,
        call_type TEXT,
        created_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_call_signals_target ON call_signals(target_user_id, created_at);

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        user_id TEXT,
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT,
        auth TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title_ar TEXT NOT NULL,
        title_en TEXT,
        author_ar TEXT NOT NULL,
        author_en TEXT,
        category TEXT NOT NULL DEFAULT 'patristics',
        cover_image_url TEXT,
        file_url TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    // Self-healing migration: older D1 databases were created before newer
    // columns existed, and CREATE TABLE IF NOT EXISTS never alters an
    // existing table. Add any missing notifications columns automatically.
    // (No PRAGMA check: just attempt ADD COLUMN and ignore "duplicate column".)
    try {
      const requiredNotifCols: Array<[string, string]> = [
        ['recipient_id', 'TEXT'],
        ['actor_id', 'TEXT'],
        ['actor_name', "TEXT DEFAULT 'Orthodox Parishioner'"],
        ['actor_avatar', 'TEXT'],
        ['type', "TEXT NOT NULL DEFAULT 'system'"],
        ['title', 'TEXT'],
        ['body', 'TEXT'],
        ['post_id', 'TEXT'],
        ['link', 'TEXT'],
        ['is_read', 'INTEGER DEFAULT 0'],
        ['created_at', "TEXT NOT NULL DEFAULT (datetime('now'))"],
      ];
      for (const [colName, colDef] of requiredNotifCols) {
        try {
          await db.exec(`ALTER TABLE notifications ADD COLUMN ${colName} ${colDef}`);
        } catch (colErr: any) {
          const colMsg = String((colErr && colErr.message) || colErr || '');
          if (!/duplicate column/i.test(colMsg)) {
            throw colErr;
          }
          // Column already exists - nothing to do.
        }
      }
    } catch (notifMigErr) {
      console.warn('[ensureD1Tables] notifications migration notice:', notifMigErr);
    }
    try {
      // Live stream replay columns (ended_at, replay_guid)
      const requiredStreamCols: Array<[string, string]> = [
        ['ended_at', 'TEXT'],
        ['replay_guid', 'TEXT'],
      ];
      for (const [colName, colDef] of requiredStreamCols) {
        try {
          await db.exec(`ALTER TABLE live_streams ADD COLUMN ${colName} ${colDef}`);
        } catch (colErr: any) {
          const colMsg = String((colErr && colErr.message) || colErr || '');
          if (!/duplicate column/i.test(colMsg)) {
            throw colErr;
          }
          // Column already exists - nothing to do.
        }
      }
    } catch (streamMigErr) {
      console.warn('[ensureD1Tables] live_streams migration notice:', streamMigErr);
    }
    try {
      // Stories media columns (media_type: image | video | audio)
      const requiredStoryCols: Array<[string, string]> = [
        ['media_type', "TEXT DEFAULT 'image'"],
      ];
      for (const [colName, colDef] of requiredStoryCols) {
        try {
          await db.exec(`ALTER TABLE stories ADD COLUMN ${colName} ${colDef}`);
        } catch (colErr: any) {
          const colMsg = String((colErr && colErr.message) || colErr || '');
          if (!/duplicate column/i.test(colMsg)) {
            throw colErr;
          }
          // Column already exists - nothing to do.
        }
      }
    } catch (storyMigErr) {
      console.warn('[ensureD1Tables] stories migration notice:', storyMigErr);
    }
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

// ---------------------------------------------------------------------------
// Web Push (incoming calls even when the app is closed)
// RFC 8291 (aes128gcm payload encryption) + RFC 8292 (VAPID auth), WebCrypto.
// ---------------------------------------------------------------------------
function b64uEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) { out.set(part, off); off += part.length; }
  return out;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const out = new Uint8Array(len);
  let t = new Uint8Array(0);
  let pos = 0;
  let counter = 1;
  while (pos < len) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t, 0);
    input.set(info, t.length);
    input[input.length - 1] = counter;
    t = await hmacSha256(prk, input);
    const take = Math.min(t.length, len - pos);
    out.set(t.subarray(0, take), pos);
    pos += take;
    counter++;
  }
  return out;
}

async function createVapidAuthHeader(endpoint: string, subject: string, vapidPublic: string, vapidPrivate: string): Promise<string> {
  const url = new URL(endpoint);
  const aud = url.protocol + '//' + url.host;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const enc = new TextEncoder();
  const headerB64 = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = b64uEncode(enc.encode(JSON.stringify({ aud, exp, sub: subject })));
  const pubRaw = b64uDecode(vapidPublic);
  const jwk: any = {
    kty: 'EC', crv: 'P-256',
    x: b64uEncode(pubRaw.slice(1, 33)),
    y: b64uEncode(pubRaw.slice(33, 65)),
    d: vapidPrivate,
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(headerB64 + '.' + payloadB64)));
  return 'WebPush ' + headerB64 + '.' + payloadB64 + '.' + b64uEncode(sig);
}

async function encryptPushPayload(p256dhB64: string, authB64: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64uDecode(p256dhB64);
  const authSecret = b64uDecode(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ephKeyPair: any = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephKeyPair.publicKey));
  const clientPubKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPubKey }, ephKeyPair.privateKey, 256));
  const prk = await hmacSha256(authSecret, ecdhSecret);
  const enc = new TextEncoder();
  const keyInfo = concatBytes(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
  const nonceInfo = concatBytes(enc.encode('Content-Encoding: nonce'), new Uint8Array([0]), uaPublic, asPublic);
  const cek = await hkdfExpand(prk, keyInfo, 32);
  const nonce = await hkdfExpand(prk, nonceInfo, 12);
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 2;
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));
  const rs = new Uint8Array([0, 0, 0x10, 0x00]);
  return concatBytes(salt, rs, new Uint8Array([1]), new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

async function sendWebPush(env: Env, sub: { endpoint: string; p256dh: string; auth: string }, payload: any): Promise<boolean> {
  try {
    const vapidPublic = (env.VAPID_PUBLIC_KEY || '').trim();
    const vapidPrivate = (env.VAPID_PRIVATE_KEY || '').trim();
    const subject = (env.VAPID_SUBJECT || 'mailto:admin@orthodoxconnect.live').trim();
    if (!vapidPublic || !vapidPrivate) {
      console.warn('[push] VAPID keys not configured; skipping push');
      return false;
    }
    const body = await encryptPushPayload(sub.p256dh, sub.auth, new TextEncoder().encode(JSON.stringify(payload)));
    const authHeader = await createVapidAuthHeader(sub.endpoint, subject, vapidPublic, vapidPrivate);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '120',
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': authHeader,
      },
      body: body as any,
    });
    if (!res.ok && (res.status === 404 || res.status === 410)) {
      try { await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run(); } catch (e) {}
    }
    return res.ok;
  } catch (e) {
    console.warn('[push] send failed:', (e as any)?.message || e);
    return false;
  }
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
  if (match) return match[1];

  if (/^[0-9a-zA-Z_-]{10,}$/.test(trimmed) && !trimmed.startsWith('http')) {
    return trimmed;
  }

  return trimmed;
}

// Schema migrations are idempotent; run them once per worker isolate and
// cache the promise so every API request doesn't pay the check cost.
let schemaEnsuredPromise: Promise<void> | null = null;
function ensureD1TablesOnce(db: D1Database): Promise<void> {
  if (!schemaEnsuredPromise) {
    schemaEnsuredPromise = ensureD1Tables(db).catch((e) => {
      console.warn('[ensureD1TablesOnce] failed, will retry on next request:', e);
      schemaEnsuredPromise = null;
    });
  }
  return schemaEnsuredPromise;
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
        // Schema check runs once per worker isolate, not on every request,
        // so API responses don't pay the migration-check cost each time.
        await ensureD1TablesOnce(env.DB);
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
            const existing = await env.DB.prepare('SELECT id FROM profiles WHERE LOWER(email) = LOWER(?)').bind(email).first();
            if (existing) {
              return jsonResponse({ success: false, error: 'An account with this email address already exists.' }, 409);
            }

            await env.DB.prepare(`
              INSERT INTO profiles (id, email, password_hash, full_name, parish, bio, avatar_url, role, is_banned, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            `).bind(userId, email, passwordHash, fullName, parish, bio, avatarUrl, role, now, now).run();
          }

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

          const isSeededOrInitial = profileRow.password_hash === 'seeded' || !profileRow.password_hash;
          if (!isSeededOrInitial && !isSuperAdmin && profileRow.password_hash !== inputHash) {
            return jsonResponse({ success: false, error: 'Invalid email or password.' }, 401);
          }

          if ((isSeededOrInitial || isSuperAdmin) && profileRow.password_hash !== inputHash) {
            profileRow.password_hash = inputHash;
            if (env.DB) {
              await env.DB.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?')
                .bind(inputHash, new Date().toISOString(), profileRow.id)
                .run();
            }
          }

          if (isSuperAdmin && profileRow.role !== 'super_admin') {
            profileRow.role = 'super_admin';
            if (env.DB) {
              await env.DB.prepare("UPDATE profiles SET role = 'super_admin' WHERE id = ?").bind(profileRow.id).run();
            }
          }

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
        // Self-heal: very early app versions created the messages table without
        // receiver_id (and other columns), so server-side save/load silently broke.
        if (env.DB) {
          const missingCols = [
            'receiver_id TEXT',
            'sender_name TEXT',
            "content TEXT NOT NULL DEFAULT ''",
            'image_url TEXT',
            'video_url TEXT',
            'audio_url TEXT',
            'is_read INTEGER DEFAULT 0',
            "created_at TEXT NOT NULL DEFAULT (datetime('now'))",
          ];
          for (const col of missingCols) {
            try { await env.DB.prepare(`ALTER TABLE messages ADD COLUMN ${col}`).run(); } catch (e) { /* column already exists */ }
          }
        }
        if (request.method === 'GET') {
          const user1 = url.searchParams.get('user1') || url.searchParams.get('sender_id');
          const user2 = url.searchParams.get('user2') || url.searchParams.get('receiver_id');
          const contactId = url.searchParams.get('contact_id');
          const myId = url.searchParams.get('my_id') || url.searchParams.get('user1') || getAuthIdentity(request).id;

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

          // Ancient messages tables have NOT NULL sender_name; resolve it.
          let senderName = body.sender_name || body.senderName || '';
          if (!senderName && env.DB && senderId) {
            try {
              const prof: any = await env.DB.prepare('SELECT full_name FROM profiles WHERE id = ?').bind(senderId).first();
              senderName = prof?.full_name || '';
            } catch (e) { /* keep empty string */ }
          }

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO messages (id, sender_id, sender_name, receiver_id, content, image_url, video_url, audio_url, is_read, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            `).bind(id, senderId, senderName, receiverId, content, imageUrl, videoUrl, audioUrl, createdAt).run();
          }

          return jsonResponse({
            success: true,
            message: { id, sender_id: senderId, sender_name: senderName, receiver_id: receiverId, content, image_url: imageUrl, video_url: videoUrl, audio_url: audioUrl, created_at: createdAt },
          }, 201);
        }
        // Mark messages as read: PATCH /api/messages with { reader_id, partner_id }
        // marks all messages from partner_id to reader_id as read.
        if (request.method === 'PATCH' && env.DB) {
          const body: any = await request.json().catch(() => ({}));
          const readerId = String(body.reader_id || body.readerId || '').replace(/^auth-/, '');
          const partnerId = String(body.partner_id || body.partnerId || '').replace(/^auth-/, '');
          if (!readerId || !partnerId) {
            return jsonResponse({ success: false, error: 'reader_id and partner_id required' }, 400);
          }
          await env.DB.prepare(
            'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0'
          ).bind(readerId, partnerId).run();
          return jsonResponse({ success: true });
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
          const mediaType = body.media_type || body.mediaType || 'image';
          const caption = body.caption || '';
          const createdAt = body.created_at || new Date().toISOString();

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO stories (id, author_id, author_name, author_avatar, author_parish, image_url, media_type, caption, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, authorId, authorName, authorAvatar, authorParish, imageUrl, mediaType, caption, createdAt).run();
          }

          return jsonResponse({
            success: true,
            story: { id, author_id: authorId, author_name: authorName, author_avatar: authorAvatar, author_parish: authorParish, image_url: imageUrl, media_type: mediaType, caption, created_at: createdAt },
          }, 201);
        }
      }

      // 6a. Single Story (/api/stories/:id) — admin/author delete
      if (url.pathname.startsWith('/api/stories/')) {
        const storyId = decodeURIComponent(url.pathname.replace('/api/stories/', '').trim());
        if (storyId && !storyId.includes('/') && request.method === 'DELETE') {
          const auth = getAuthIdentity(request);
          let story: any = null;
          if (env.DB) {
            story = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(storyId).first();
          }
          if (!story) return jsonResponse({ success: false, error: 'Story not found' }, 404);
          const isAuthor = Boolean(auth.id && story.author_id && auth.id === story.author_id);
          if (!auth.isAdmin && !isAuthor) {
            return jsonResponse({ success: false, error: 'Forbidden: Admin access required.' }, 403);
          }
          if (env.DB) {
            await env.DB.prepare('DELETE FROM stories WHERE id = ?').bind(storyId).run();
          }
          return jsonResponse({ success: true, id: storyId, message: 'Story deleted successfully.' });
        }
      }

      // 6b. Churches Endpoints (/api/churches)
      if (url.pathname === '/api/churches' || url.pathname === '/api/churches/') {
        // Bulletproof: ensure the table exists on the request path itself.
        if (env.DB) {
          try {
            await env.DB.exec(`CREATE TABLE IF NOT EXISTS churches (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT DEFAULT '',
              cover TEXT DEFAULT '', description TEXT DEFAULT '', address TEXT DEFAULT '',
              city TEXT DEFAULT '', country TEXT DEFAULT '', priest_name TEXT DEFAULT '',
              phone TEXT DEFAULT '', website TEXT DEFAULT '', service_times TEXT DEFAULT '',
              owner_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
          } catch (ctErr) {
            console.warn('[churches] ensure table notice:', ctErr);
          }
        }
        if (request.method === 'GET') {
          let churches: any[] = [];
          if (env.DB) {
            const q = (url.searchParams.get('q') || '').trim();
            let stmt;
            if (q) {
              const like = `%${q}%`;
              stmt = env.DB.prepare(
                `SELECT * FROM churches WHERE name LIKE ? OR city LIKE ? OR country LIKE ? ORDER BY name ASC LIMIT 100`
              ).bind(like, like, like);
            } else {
              stmt = env.DB.prepare('SELECT * FROM churches ORDER BY name ASC LIMIT 100');
            }
            const { results } = await stmt.all();
            churches = results || [];
          }
          return jsonResponse({ success: true, churches });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const name = (body.name || '').trim();
          if (!name) {
            return jsonResponse({ success: false, error: 'Church name is required' }, 400);
          }
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `church_${Date.now()}`);
          const auth = getAuthIdentity(request);
          const ownerId = body.owner_id || auth.id || null;
          const row = {
            id,
            name,
            avatar: body.avatar || '',
            cover: body.cover || '',
            description: body.description || '',
            address: body.address || '',
            city: body.city || '',
            country: body.country || '',
            priest_name: body.priest_name || '',
            phone: body.phone || '',
            website: body.website || '',
            service_times: body.service_times || '',
            owner_id: ownerId,
            created_at: new Date().toISOString(),
          };
          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO churches (id, name, avatar, cover, description, address, city, country, priest_name, phone, website, service_times, owner_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(row.id, row.name, row.avatar, row.cover, row.description, row.address, row.city, row.country, row.priest_name, row.phone, row.website, row.service_times, row.owner_id, row.created_at).run();
          }
          return jsonResponse({ success: true, church: row }, 201);
        }
      }

      // Single Church (/api/churches/:id)
      if (url.pathname.startsWith('/api/churches/')) {
        const churchId = decodeURIComponent(url.pathname.replace('/api/churches/', '').trim());
        if (churchId && !churchId.includes('/')) {
          if (request.method === 'GET') {
            let church: any = null;
            if (env.DB) {
              church = await env.DB.prepare('SELECT * FROM churches WHERE id = ?').bind(churchId).first();
            }
            if (!church) return jsonResponse({ success: false, error: 'Church not found' }, 404);
            return jsonResponse({ success: true, church });
          }
          if (request.method === 'PATCH') {
            const body: any = await request.json().catch(() => ({}));
            const auth = getAuthIdentity(request);
            let existing: any = null;
            if (env.DB) {
              existing = await env.DB.prepare('SELECT * FROM churches WHERE id = ?').bind(churchId).first();
            }
            if (!existing) return jsonResponse({ success: false, error: 'Church not found' }, 404);
            const isOwner = auth.id && existing.owner_id && auth.id === existing.owner_id;
            if (!isOwner && !auth.isAdmin) {
              return jsonResponse({ success: false, error: 'Not authorized to edit this church' }, 403);
            }
            const fields = ['name', 'avatar', 'cover', 'description', 'address', 'city', 'country', 'priest_name', 'phone', 'website', 'service_times'];
            const sets: string[] = [];
            const vals: any[] = [];
            for (const f of fields) {
              if (body[f] !== undefined) {
                sets.push(`${f} = ?`);
                vals.push(body[f]);
              }
            }
            if (sets.length && env.DB) {
              await env.DB.prepare(`UPDATE churches SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, churchId).run();
            }
            let updated: any = existing;
            if (env.DB) {
              updated = await env.DB.prepare('SELECT * FROM churches WHERE id = ?').bind(churchId).first();
            }
            return jsonResponse({ success: true, church: updated });
          }
          if (request.method === 'DELETE') {
            const auth = getAuthIdentity(request);
            if (!auth.isAdmin) {
              return jsonResponse({ success: false, error: 'Forbidden: Admin access required.' }, 403);
            }
            if (env.DB) {
              await env.DB.prepare('DELETE FROM churches WHERE id = ?').bind(churchId).run();
            }
            return jsonResponse({ success: true, id: churchId, message: 'Church deleted successfully.' });
          }
        }
      }

      // 6c. Marketplace Endpoints (/api/marketplace)
      if (url.pathname === '/api/marketplace' || url.pathname === '/api/marketplace/') {
        // Bulletproof: ensure the table exists on the request path itself.
        let mktTableError: string | null = null;
        if (env.DB) {
          try {
            await env.DB.exec(`CREATE TABLE IF NOT EXISTS marketplace_listings (
              id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
              price TEXT DEFAULT '', category TEXT DEFAULT 'other', images TEXT DEFAULT '[]',
              address TEXT DEFAULT '', city TEXT DEFAULT '', phone TEXT DEFAULT '',
              church_id TEXT DEFAULT '', church_name TEXT DEFAULT '',
              seller_id TEXT, seller_name TEXT DEFAULT '', seller_avatar TEXT DEFAULT '',
              status TEXT DEFAULT 'active',
              created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
          } catch (ctErr) {
            mktTableError = (ctErr as any)?.message || String(ctErr);
            console.warn('[marketplace] ensure table notice:', ctErr);
          }
          // Verify the table actually exists; surface the creation error if not.
          try {
            await env.DB.prepare(`SELECT 1 FROM marketplace_listings LIMIT 1`).all();
          } catch (vErr) {
            if (!mktTableError) mktTableError = 'create appeared to succeed but table still missing: ' + (((vErr as any)?.message) || String(vErr));
          }
        }
        const parseImages = (row: any) => {
          try {
            const imgs = typeof row.images === 'string' ? JSON.parse(row.images || '[]') : (row.images || []);
            return { ...row, images: Array.isArray(imgs) ? imgs : [] };
          } catch {
            return { ...row, images: [] };
          }
        };
        if (request.method === 'GET') {
          let listings: any[] = [];
          if (env.DB) {
            const q = (url.searchParams.get('q') || '').trim();
            const category = (url.searchParams.get('category') || '').trim();
            const status = (url.searchParams.get('status') || 'active').trim();
            const conds: string[] = [];
            const vals: any[] = [];
            if (status && status !== 'all') { conds.push('status = ?'); vals.push(status); }
            if (category && category !== 'all') { conds.push('category = ?'); vals.push(category); }
            if (q) {
              const like = `%${q}%`;
              conds.push('(title LIKE ? OR description LIKE ? OR city LIKE ? OR church_name LIKE ?)');
              vals.push(like, like, like, like);
            }
            const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
            const stmt = env.DB.prepare(`SELECT * FROM marketplace_listings ${where} ORDER BY created_at DESC LIMIT 100`).bind(...vals);
            try {
              const { results } = await stmt.all();
              listings = (results || []).map(parseImages);
            } catch (qErr) {
              const getResp: any = { success: false, error: ((qErr as any)?.message) || String(qErr) };
              if (mktTableError) getResp._tableError = mktTableError;
              else getResp._tableError = 'CREATE TABLE did not throw, but table is still missing (verify query failed).';
              return jsonResponse(getResp, 500);
            }
          }
          const getResp: any = { success: true, listings };
          if (mktTableError) getResp._tableError = mktTableError;
          return jsonResponse(getResp);
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const title = (body.title || '').trim();
          if (!title) {
            return jsonResponse({ success: false, error: 'Title is required' }, 400);
          }
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mkt_${Date.now()}`);
          const auth = getAuthIdentity(request);
          const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
          const row = {
            id,
            title,
            description: body.description || '',
            price: body.price || '',
            category: body.category || 'other',
            images: JSON.stringify(images),
            address: body.address || '',
            city: body.city || '',
            phone: body.phone || '',
            church_id: body.church_id || '',
            church_name: body.church_name || '',
            seller_id: body.seller_id || auth.id || null,
            seller_name: body.seller_name || '',
            seller_avatar: body.seller_avatar || '',
            status: 'active',
            created_at: new Date().toISOString(),
          };
          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO marketplace_listings (id, title, description, price, category, images, address, city, phone, church_id, church_name, seller_id, seller_name, seller_avatar, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(row.id, row.title, row.description, row.price, row.category, row.images, row.address, row.city, row.phone, row.church_id, row.church_name, row.seller_id, row.seller_name, row.seller_avatar, row.status, row.created_at).run();
          }
          return jsonResponse({ success: true, listing: { ...row, images } }, 201);
        }
      }

      // Single Marketplace Listing (/api/marketplace/:id)
      if (url.pathname.startsWith('/api/marketplace/')) {
        const listingId = decodeURIComponent(url.pathname.replace('/api/marketplace/', '').trim());
        if (listingId && !listingId.includes('/')) {
          if (env.DB) {
            try {
              await env.DB.exec(`CREATE TABLE IF NOT EXISTS marketplace_listings (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
                price TEXT DEFAULT '', category TEXT DEFAULT 'other', images TEXT DEFAULT '[]',
                address TEXT DEFAULT '', city TEXT DEFAULT '', phone TEXT DEFAULT '',
                church_id TEXT DEFAULT '', church_name TEXT DEFAULT '',
                seller_id TEXT, seller_name TEXT DEFAULT '', seller_avatar TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
            } catch (ctErr) {
              console.warn('[marketplace] ensure table notice:', ctErr);
            }
          }
          const parseImages = (row: any) => {
            try {
              const imgs = typeof row.images === 'string' ? JSON.parse(row.images || '[]') : (row.images || []);
              return { ...row, images: Array.isArray(imgs) ? imgs : [] };
            } catch {
              return { ...row, images: [] };
            }
          };
          if (request.method === 'GET') {
            let listing: any = null;
            if (env.DB) {
              listing = await env.DB.prepare('SELECT * FROM marketplace_listings WHERE id = ?').bind(listingId).first();
            }
            if (!listing) return jsonResponse({ success: false, error: 'Listing not found' }, 404);
            return jsonResponse({ success: true, listing: parseImages(listing) });
          }
          if (request.method === 'PATCH') {
            const body: any = await request.json().catch(() => ({}));
            const auth = getAuthIdentity(request);
            let existing: any = null;
            if (env.DB) {
              existing = await env.DB.prepare('SELECT * FROM marketplace_listings WHERE id = ?').bind(listingId).first();
            }
            if (!existing) return jsonResponse({ success: false, error: 'Listing not found' }, 404);
            const isOwner = auth.id && existing.seller_id && auth.id === existing.seller_id;
            if (!isOwner && !auth.isAdmin) {
              return jsonResponse({ success: false, error: 'Not authorized to edit this listing' }, 403);
            }
            const fields = ['title', 'description', 'price', 'category', 'address', 'city', 'phone', 'church_id', 'church_name', 'status'];
            const sets: string[] = [];
            const vals: any[] = [];
            for (const f of fields) {
              if (body[f] !== undefined) {
                sets.push(`${f} = ?`);
                vals.push(body[f]);
              }
            }
            if (body.images !== undefined && Array.isArray(body.images)) {
              sets.push('images = ?');
              vals.push(JSON.stringify(body.images.slice(0, 6)));
            }
            if (sets.length && env.DB) {
              await env.DB.prepare(`UPDATE marketplace_listings SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, listingId).run();
            }
            let updated: any = existing;
            if (env.DB) {
              updated = await env.DB.prepare('SELECT * FROM marketplace_listings WHERE id = ?').bind(listingId).first();
            }
            return jsonResponse({ success: true, listing: updated ? parseImages(updated) : updated });
          }
          if (request.method === 'DELETE') {
            const auth = getAuthIdentity(request);
            let existing: any = null;
            if (env.DB) {
              existing = await env.DB.prepare('SELECT * FROM marketplace_listings WHERE id = ?').bind(listingId).first();
            }
            if (!existing) return jsonResponse({ success: false, error: 'Listing not found' }, 404);
            const isOwner = auth.id && existing.seller_id && auth.id === existing.seller_id;
            if (!isOwner && !auth.isAdmin) {
              return jsonResponse({ success: false, error: 'Not authorized to delete this listing' }, 403);
            }
            if (env.DB) {
              await env.DB.prepare('DELETE FROM marketplace_listings WHERE id = ?').bind(listingId).run();
            }
            return jsonResponse({ success: true, id: listingId, message: 'Listing deleted successfully.' });
          }
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
          const auth = getAuthIdentity(request);
          let event: any = null;
          if (env.DB) {
            event = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first();
          }
          const isHost = Boolean(auth.id && event && event.host_id && auth.id === event.host_id);
          if (!auth.isAdmin && !isHost) {
            return jsonResponse({ success: false, error: 'Forbidden: Admin access required.' }, 403);
          }
          if (env.DB) {
            await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run();
          }
          return jsonResponse({ success: true, message: 'Event deleted successfully.' });
        }
      }

      // 8b. Live Stream item endpoint (PATCH /api/live-streams/:id)
      // Used to end a broadcast and attach the saved replay recording.
      if (url.pathname.startsWith('/api/live-streams/') && request.method === 'PATCH') {
        const streamId = decodeURIComponent(url.pathname.slice('/api/live-streams/'.length)).split('/')[0];
        const body: any = await request.json().catch(() => ({}));
        if (!env.DB) {
          return jsonResponse({ success: false, error: 'Database unavailable' }, 500);
        }
        const updates: string[] = [];
        const vals: any[] = [];
        if (body.is_live !== undefined) { updates.push('is_live = ?'); vals.push(body.is_live ? 1 : 0); }
        if (body.ended_at !== undefined) { updates.push('ended_at = ?'); vals.push(body.ended_at); }
        if (body.replay_guid !== undefined) { updates.push('replay_guid = ?'); vals.push(body.replay_guid); }
        if (body.viewers_count !== undefined) { updates.push('viewers_count = ?'); vals.push(body.viewers_count); }
        if (body.title !== undefined) { updates.push('title = ?'); vals.push(body.title); }
        if (updates.length > 0) {
          vals.push(streamId);
          await env.DB.prepare(`UPDATE live_streams SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
        }
        const row = await env.DB.prepare('SELECT * FROM live_streams WHERE id = ?').bind(streamId).first();
        return jsonResponse({ success: true, stream: row });
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
            // Match by author id, or by author name as a fallback for
            // legacy posts stored without an author id.
            conditions.push('(author_id = ? OR author_name = ?)');
            params.push(authorId, authorId);
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

          let posts: any[] = [];
          if (env.DB) {
            try {
              const stmt = env.DB.prepare(query).bind(...params);
              const { results } = await stmt.all<any>();
              posts = results || [];
            } catch (queryErr) {
              const fallbackStmt = env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset);
              const { results } = await fallbackStmt.all<any>();
              posts = results || [];
            }

            if (posts.length > 0) {
              const auth = getAuthIdentity(request);
              const currentUserId = url.searchParams.get('user_id') || auth.id || '';
              const postIds: string[] = posts.map((p: any) => p.id);

              // Batched enrichment: 4 queries total instead of 4-per-post.
              // D1 bound-parameter limits mean we chunk post IDs into groups of 50.
              const likedByUser = new Set<string>();
              const likesCount = new Map<string, number>();
              const commentsCount = new Map<string, number>();
              const likersMap = new Map<string, any[]>();

              try {
                for (let i = 0; i < postIds.length; i += 50) {
                  const chunk = postIds.slice(i, i + 50);
                  const placeholders = chunk.map(() => '?').join(',');

                  if (currentUserId) {
                    const likedRows = await env.DB.prepare(
                      `SELECT post_id FROM post_likes WHERE post_id IN (${placeholders}) AND user_id = ?`
                    ).bind(...chunk, currentUserId).all<any>();
                    for (const r of (likedRows?.results || [])) likedByUser.add(String(r.post_id));
                  }

                  const likeCountRows = await env.DB.prepare(
                    `SELECT post_id, COUNT(*) as cnt FROM post_likes WHERE post_id IN (${placeholders}) GROUP BY post_id`
                  ).bind(...chunk).all<any>();
                  for (const r of (likeCountRows?.results || [])) likesCount.set(String(r.post_id), Number(r.cnt));

                  const commCountRows = await env.DB.prepare(
                    `SELECT post_id, COUNT(*) as cnt FROM post_comments WHERE post_id IN (${placeholders}) GROUP BY post_id`
                  ).bind(...chunk).all<any>();
                  for (const r of (commCountRows?.results || [])) commentsCount.set(String(r.post_id), Number(r.cnt));

                  const likersRows = await env.DB.prepare(
                    `SELECT post_id, user_id, user_name, user_avatar FROM post_likes WHERE post_id IN (${placeholders}) ORDER BY created_at DESC`
                  ).bind(...chunk).all<any>();
                  for (const r of (likersRows?.results || [])) {
                    const key = String(r.post_id);
                    const arr = likersMap.get(key) || [];
                    if (arr.length < 15) {
                      arr.push({
                        userId: r.user_id,
                        userName: r.user_name || 'Orthodox Member',
                        userAvatar: r.user_avatar,
                      });
                      likersMap.set(key, arr);
                    }
                  }
                }
              } catch (calcErr) {
                // Fall back smoothly
              }

              for (const p of posts) {
                const key = String(p.id);
                p.is_liked = likedByUser.has(key);
                p.likes_count = likesCount.has(key) ? likesCount.get(key) : (Number(p.likes_count) || 0);
                p.comments_count = commentsCount.has(key) ? commentsCount.get(key) : (Number(p.comments_count) || 0);
                p.likers = likersMap.get(key) || [];
              }
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
          const likesCount = Number(body.likes_count ?? body.likesCount ?? 0);
          const commentsCount = Number(body.comments_count ?? body.commentsCount ?? 0);
          const resharesCount = Number(body.reshares_count ?? body.resharesCount ?? 0);
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

      // 12. Post Likes List (/api/posts/:id/likes)
      if (url.pathname.match(/^\/api\/posts\/[^/]+\/likes\/?$/) && request.method === 'GET') {
        const postId = decodeURIComponent(url.pathname.replace('/api/posts/', '').replace(/\/likes\/?$/, ''));
        let likes: any[] = [];
        if (env.DB) {
          const { results } = await env.DB.prepare('SELECT user_id, user_name, user_avatar, created_at FROM post_likes WHERE post_id = ? ORDER BY created_at DESC').bind(postId).all();
          likes = (results || []).map((r: any) => ({
            userId: r.user_id,
            userName: r.user_name || 'Orthodox Member',
            userAvatar: r.user_avatar,
          }));
        }
        return jsonResponse({ success: true, post_id: postId, likes, count: likes.length });
      }

      // 12b. Atomic Per-User Post Like Toggle (/api/posts/:id/like)
      if (url.pathname.match(/^\/api\/posts\/[^/]+\/like\/?$/)) {
        if (request.method !== 'POST') {
          return jsonResponse({ success: false, error: `Method ${request.method} not allowed` }, 405);
        }

        const postId = decodeURIComponent(url.pathname.replace('/api/posts/', '').replace(/\/like\/?$/, ''));
        const body: any = await request.json().catch(() => ({}));
        const auth = getAuthIdentity(request);

        const userId = (body.user_id || body.userId || auth.id || (auth.email ? `user-${auth.email}` : null))?.trim();
        if (!userId) {
          return jsonResponse({ success: false, error: 'Authentication required to bless posts' }, 401);
        }

        const actorName = body.author_name || body.userName || body.user_name || auth.email || 'Orthodox Parishioner';
        const actorAvatar = body.author_avatar || body.userAvatar || body.user_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

        let isLiked = false;
        let likesCount = 0;
        let likers: any[] = [];

        if (env.DB) {
          const existingLike = await env.DB.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?')
            .bind(postId, userId)
            .first();

          const postRow = await env.DB.prepare('SELECT author_id, content FROM posts WHERE id = ?').bind(postId).first<D1PostRow>();

          if (existingLike) {
            // UNLIKE: Remove strictly this user's record
            await env.DB.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').bind(postId, userId).run();
            isLiked = false;
          } else {
            // LIKE: Insert or replace record for this user
            await env.DB.prepare('INSERT OR REPLACE INTO post_likes (post_id, user_id, user_name, user_avatar, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))')
              .bind(postId, userId, actorName, actorAvatar)
              .run();
            isLiked = true;

            if (postRow && postRow.author_id && postRow.author_id !== userId) {
              const notifId = `notif-like-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              await env.DB.prepare(
                'INSERT INTO notifications (id, recipient_id, actor_id, actor_name, actor_avatar, type, title, body, post_id, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(notifId, postRow.author_id, userId, actorName, actorAvatar, 'like', `${actorName} blessed your reflection`, (postRow.content || '').slice(0, 80), postId, 'feed', 0, new Date().toISOString()).run();
            }
          }

          // Strict source of truth: count current rows in post_likes
          const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?').bind(postId).first<{ count: number }>();
          likesCount = countRow ? Number(countRow.count) : 0;

          await env.DB.prepare('UPDATE posts SET likes_count = ? WHERE id = ?').bind(likesCount, postId).run();

          const likersResult = await env.DB.prepare('SELECT user_id, user_name, user_avatar FROM post_likes WHERE post_id = ? ORDER BY created_at DESC LIMIT 15').bind(postId).all<any>();
          likers = (likersResult?.results || []).map((r: any) => ({
            userId: r.user_id,
            userName: r.user_name || 'Orthodox Member',
            userAvatar: r.user_avatar,
          }));
        }

        return jsonResponse({
          success: true,
          post_id: postId,
          is_liked: isLiked,
          liked: isLiked,
          likes_count: likesCount,
          likers,
        });
      }

      // 13. Delete Single Comment (/api/posts/:id/comments/:commentId or /api/comments/:commentId)
      if (
        (url.pathname.match(/^\/api\/posts\/[^/]+\/comments\/[^/]+\/?$/) || url.pathname.match(/^\/api\/comments\/[^/]+\/?$/)) &&
        request.method === 'DELETE'
      ) {
        const parts = url.pathname.split('/').filter(Boolean);
        const commentId = decodeURIComponent(parts[parts.length - 1]);
        const postId = parts.length >= 4 && parts[1] === 'posts' ? decodeURIComponent(parts[2]) : null;
        const auth = getAuthIdentity(request);

        if (env.DB) {
          const comm = await env.DB.prepare('SELECT * FROM post_comments WHERE id = ?').bind(commentId).first<any>();
          if (comm) {
            const isCommentAuthor = Boolean(auth.id && comm.user_id && auth.id === comm.user_id);
            const targetPostId = postId || comm.post_id;
            const post = await env.DB.prepare('SELECT author_id FROM posts WHERE id = ?').bind(targetPostId).first<any>();
            const isPostAuthor = Boolean(auth.id && post && post.author_id && auth.id === post.author_id);

            if (auth.isAdmin || isCommentAuthor || isPostAuthor) {
              await env.DB.prepare('DELETE FROM post_comments WHERE id = ?').bind(commentId).run();
              const commCountRow = await env.DB.prepare('SELECT COUNT(*) as count FROM post_comments WHERE post_id = ?').bind(targetPostId).first<{ count: number }>();
              const newCommCount = commCountRow ? Number(commCountRow.count) : 0;
              await env.DB.prepare('UPDATE posts SET comments_count = ? WHERE id = ?').bind(newCommCount, targetPostId).run();
              return jsonResponse({ success: true, deleted: commentId, comments_count: newCommCount });
            }
            return jsonResponse({ success: false, error: 'Forbidden: You do not have permission to delete this comment.' }, 403);
          }
        }
        return jsonResponse({ success: false, error: 'Comment not found' }, 404);
      }

      // 14. Post Comments List & Create (/api/posts/:id/comments)
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
          const auth = getAuthIdentity(request);
          const userId = body.user_id || body.userId || auth.id || null;
          const authorName = body.author_name || body.authorName || auth.email || 'Orthodox Parishioner';
          const authorAvatar = body.author_avatar || body.authorAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
          const createdAt = body.created_at || new Date().toISOString();

          if (!content) {
            return jsonResponse({ success: false, error: 'Comment content cannot be empty' }, 400);
          }

          let newCommentCount = 1;
          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO post_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(id, postId, userId, authorName, authorAvatar, content, createdAt).run();

            const commCountRow = await env.DB.prepare('SELECT COUNT(*) as count FROM post_comments WHERE post_id = ?').bind(postId).first<{ count: number }>();
            newCommentCount = commCountRow ? Number(commCountRow.count) : 1;
            await env.DB.prepare('UPDATE posts SET comments_count = ? WHERE id = ?').bind(newCommentCount, postId).run();

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
            comments_count: newCommentCount,
          }, 201);
        }
      }

      // 15. Single Post Delete/Get (/api/posts/:id)
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

      // 16. Books & Library Endpoints (/api/books and /api/books/:id)
      if (url.pathname === '/api/books' || url.pathname === '/api/books/') {
        if (request.method === 'GET') {
          const category = url.searchParams.get('category');
          const q = (url.searchParams.get('q') || '').trim();

          let books: D1BookRow[] = [];
          if (env.DB) {
            let query = 'SELECT * FROM books WHERE 1=1';
            const params: any[] = [];

            if (category && category !== 'all') {
              query += ' AND category = ?';
              params.push(category);
            }

            if (q) {
              query += ' AND (title_ar LIKE ? OR title_en LIKE ? OR author_ar LIKE ? OR author_en LIKE ?)';
              const pattern = `%${q}%`;
              params.push(pattern, pattern, pattern, pattern);
            }

            query += ' ORDER BY datetime(created_at) DESC, created_at DESC';

            const stmt = env.DB.prepare(query).bind(...params);
            const { results } = await stmt.all<D1BookRow>();
            books = results || [];
          }

          return jsonResponse(books);
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || `book-${Date.now()}`;
          const titleAr = (body.title_ar || '').trim();
          const titleEn = (body.title_en || '').trim() || null;
          const authorAr = (body.author_ar || '').trim();
          const authorEn = (body.author_en || '').trim() || null;
          const category = body.category || 'patristics';
          const coverImageUrl = body.cover_image_url || null;
          const fileUrl = (body.file_url || '').trim();
          const description = (body.description || '').trim() || null;
          const createdAt = new Date().toISOString();

          if (!titleAr || !authorAr || !fileUrl) {
            return jsonResponse({ success: false, error: 'Title (Arabic), Author (Arabic), and File/Link are required.' }, 400);
          }

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO books (id, title_ar, title_en, author_ar, author_en, category, cover_image_url, file_url, description, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, titleAr, titleEn, authorAr, authorEn, category, coverImageUrl, fileUrl, description, createdAt).run();
          }

          return jsonResponse({
            success: true,
            book: { id, title_ar: titleAr, title_en: titleEn, author_ar: authorAr, author_en: authorEn, category, cover_image_url: coverImageUrl, file_url: fileUrl, description, created_at: createdAt },
          }, 201);
        }
      }

      if (url.pathname.startsWith('/api/books/')) {
        const bookId = decodeURIComponent(url.pathname.replace('/api/books/', '').trim());

        if (request.method === 'GET') {
          let book: D1BookRow | null = null;
          if (env.DB) {
            book = await env.DB.prepare('SELECT * FROM books WHERE id = ?').bind(bookId).first<D1BookRow>();
          }
          if (!book) return jsonResponse({ success: false, error: 'Book not found' }, 404);
          return jsonResponse({ success: true, book });
        }

        if (request.method === 'PUT' || request.method === 'PATCH') {
          const body: any = await request.json().catch(() => ({}));
          const titleAr = (body.title_ar || '').trim();
          const titleEn = (body.title_en || '').trim() || null;
          const authorAr = (body.author_ar || '').trim();
          const authorEn = (body.author_en || '').trim() || null;
          const category = body.category || 'patristics';
          const coverImageUrl = body.cover_image_url || null;
          const fileUrl = (body.file_url || '').trim();
          const description = (body.description || '').trim() || null;

          if (!titleAr || !authorAr || !fileUrl) {
            return jsonResponse({ success: false, error: 'Title, Author, and File/Link are required.' }, 400);
          }

          if (env.DB) {
            await env.DB.prepare(`
              UPDATE books SET
                title_ar = ?,
                title_en = ?,
                author_ar = ?,
                author_en = ?,
                category = ?,
                cover_image_url = ?,
                file_url = ?,
                description = ?
              WHERE id = ?
            `).bind(titleAr, titleEn, authorAr, authorEn, category, coverImageUrl, fileUrl, description, bookId).run();
          }

          return jsonResponse({ success: true, message: 'Book updated successfully.' });
        }

        if (request.method === 'DELETE') {
          const auth = getAuthIdentity(request);
          if (!auth.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden: Admin access required.' }, 403);
          }
          if (env.DB) {
            await env.DB.prepare('DELETE FROM books WHERE id = ?').bind(bookId).run();
          }
          return jsonResponse({ success: true, id: bookId, message: 'Book deleted successfully.' });
        }
      }

      // 17. Notifications (/api/notifications)
      if (url.pathname === '/api/notifications/mark-read' || url.pathname === '/api/notifications/mark-read/') {
        if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
        const body: any = await request.json().catch(() => ({}));
        const id = body.id;
        const recipientId = body.recipient_id || body.user_id || body.userId;
        const markAll = Boolean(body.all);
        const typeFilter = body.type || null;

        if (env.DB) {
          if (id) {
            await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(id).run();
          } else if (markAll || recipientId) {
            if (recipientId) {
              if (typeFilter) {
                await env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE (recipient_id = ? OR recipient_id = 'all' OR recipient_id IS NULL) AND type = ?").bind(recipientId, typeFilter).run();
              } else {
                await env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE recipient_id = ? OR recipient_id = 'all' OR recipient_id IS NULL").bind(recipientId).run();
              }
            } else {
              if (typeFilter) {
                await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE type = ?').bind(typeFilter).run();
              } else {
                await env.DB.prepare('UPDATE notifications SET is_read = 1').run();
              }
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

          // Phone-top Web Push to the recipient's devices (like Instagram/Facebook).
          // Fires for every notification type: messages, blessings, comments, etc.
          const pushInfo: any = { attempted: false, subscriptions: 0, sent: 0 };
          if (recipientId && recipientId !== 'all' && env.DB) {
            pushInfo.attempted = true;
            try {
              const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(recipientId).all();
              const subs = results || [];
              pushInfo.subscriptions = subs.length;
              if (subs.length > 0) {
                const pushPayload = {
                  type,
                  title,
                  body: notifBody || title,
                  icon: actorAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
                  data: { url: '/', notifType: type, link: link || undefined, notifId: id },
                };
                for (const s of subs as any[]) {
                  if (s && s.endpoint && s.p256dh && s.auth) {
                    await sendWebPush(env, { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, pushPayload);
                    pushInfo.sent++;
                  }
                }
              }
            } catch (e) { pushInfo.error = (e as any)?.message || String(e); }
          }

          return jsonResponse({ success: true, notification: { id, recipient_id: recipientId, actor_name: actorName, title, body: notifBody, created_at: createdAt }, _push: pushInfo }, 201);
        }
      }

      if (url.pathname.startsWith('/api/notifications/')) {
        const notifId = decodeURIComponent(url.pathname.replace('/api/notifications/', '').trim());
        if (request.method === 'DELETE' && env.DB) {
          await env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(notifId).run();
          return jsonResponse({ success: true, id: notifId, message: 'Notification deleted' });
        }
      }

      // 17b. Call signaling relay + Web Push (cross-device calls, works even when app is closed)
      if (url.pathname === '/api/call-signals' || url.pathname === '/api/call-signals/') {
        if (request.method === 'POST' && env.DB) {
          const sig: any = await request.json().catch(() => ({}));
          const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sig-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
          const nowMs = Date.now();
          const sigType = String(sig.type || sig.sig_type || 'OFFER_CALL');
          const callId = String(sig.callId || sig.call_id || '');
          const callerId = String(sig.callerId || sig.caller_id || '');
          const callerName = String(sig.callerName || sig.caller_name || 'Orthodox Parishioner');
          const callerAvatar = sig.callerAvatar || sig.caller_avatar || null;
          const targetUserId = String(sig.targetUserId || sig.target_user_id || '');
          const callType = String(sig.callType || sig.call_type || 'audio');
          try { await env.DB.prepare('DELETE FROM call_signals WHERE created_at < ?').bind(nowMs - 120000).run(); } catch (e) {}
          await env.DB.prepare(
            'INSERT INTO call_signals (id, call_id, sig_type, caller_id, caller_name, caller_avatar, target_user_id, call_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, callId, sigType, callerId, callerName, callerAvatar, targetUserId, callType, nowMs).run();

          if (sigType === 'OFFER_CALL' && targetUserId) {
            try {
              const notifId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}`);
              await env.DB.prepare(
                'INSERT INTO notifications (id, recipient_id, actor_id, actor_name, actor_avatar, type, title, body, post_id, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(notifId, targetUserId, callerId, callerName, callerAvatar, 'call',
                `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
                `${callerName} is calling you.`, null, 'messages', 0, new Date().toISOString()).run();
            } catch (e) { console.warn('[call-signals] bell insert failed:', (e as any)?.message || e); }
            try {
              const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(targetUserId).all();
              const subs = results || [];
              const pushPayload = {
                type: 'call',
                title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
                body: `${callerName} is calling you on OrthodoxConnect.`,
                icon: callerAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
                data: { url: '/?call=' + callId, callId, callerName, callType },
              };
              for (const s of subs as any[]) {
                if (s && s.endpoint && s.p256dh && s.auth) {
                  await sendWebPush(env, { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, pushPayload);
                }
              }
            } catch (e) { console.warn('[call-signals] push failed:', (e as any)?.message || e); }
          }
          return jsonResponse({ success: true, id }, 201);
        }
        if (request.method === 'GET' && env.DB) {
          const userId = url.searchParams.get('user_id') || '';
          const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
          let signals: any[] = [];
          if (userId) {
            const { results } = await env.DB.prepare(
              'SELECT id, call_id, sig_type, caller_id, caller_name, caller_avatar, target_user_id, call_type, created_at FROM call_signals WHERE target_user_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 50'
            ).bind(userId, since).all();
            signals = results || [];
          }
          return jsonResponse({ success: true, signals });
        }
      }

      if (url.pathname.startsWith('/api/call-signals/')) {
        const sigId = decodeURIComponent(url.pathname.replace('/api/call-signals/', '').trim());
        if (request.method === 'DELETE' && env.DB && sigId) {
          await env.DB.prepare('DELETE FROM call_signals WHERE id = ?').bind(sigId).run();
          return jsonResponse({ success: true, id: sigId });
        }
      }

      // 17c. Push subscriptions (Web Push for calls when app is closed)
      // Test push endpoint: send a test notification to all of a user's devices
      if (url.pathname === '/api/push-subscriptions/test' && request.method === 'POST' && env.DB) {
        const body: any = await request.json().catch(() => ({}));
        const userId = String(body.user_id || body.userId || '');
        if (!userId) return jsonResponse({ success: false, error: 'user_id required' }, 400);
        const { results } = await env.DB.prepare(
          'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
        ).bind(userId).all();
        let sent = 0;
        for (const s of (results || []) as any[]) {
          const ok = await sendWebPush(env, { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, {
            title: 'OrthodoxConnect ✓',
            body: 'Push notifications are working on this device!',
            icon: 'https://orthodoxconnect.live/launchericon-512x512.png',
            badge: 'https://orthodoxconnect.live/launchericon-512x512.png',
            data: { url: '/' },
          });
          if (ok) sent++;
        }
        return jsonResponse({ success: true, subscriptions: (results || []).length, sent });
      }
      if (url.pathname === '/api/push-subscriptions' || url.pathname === '/api/push-subscriptions/') {
        if (request.method === 'POST' && env.DB) {
          const body: any = await request.json().catch(() => ({}));
          const userId = String(body.user_id || body.userId || '');
          const sub = body.subscription || {};
          const endpoint = String(sub.endpoint || '');
          const p256dh = String((sub.keys && sub.keys.p256dh) || '');
          const auth = String((sub.keys && sub.keys.auth) || '');
          if (!userId || !endpoint || !p256dh || !auth) {
            return jsonResponse({ success: false, error: 'user_id, endpoint, p256dh and auth are required' }, 400);
          }
          await env.DB.prepare(
            'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(userId, endpoint, p256dh, auth, new Date().toISOString()).run();
          return jsonResponse({ success: true }, 201);
        }
        if (request.method === 'DELETE' && env.DB) {
          const body: any = await request.json().catch(() => ({}));
          const userId = String(body.user_id || body.userId || '');
          const endpoint = String(body.endpoint || '');
          const clearAll = body.clear_all === true;
          if (clearAll && userId) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId).run();
          } else if (userId && endpoint) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').bind(userId, endpoint).run();
          } else if (endpoint) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
          }
          return jsonResponse({ success: true });
        }
      }

      // 18. User Administration Delete endpoint (/api/users/:id)
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