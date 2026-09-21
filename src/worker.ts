/**
 * Cloudflare Worker API for OrthodoxConnect
 * 100% Cloudflare Workers + Cloudflare D1 SQLite Engine
 * Handles Authentication, Posts, Profiles, Messages, Stories, Events,
 * Live Streams, Moderation Reports, Notifications, Bunny Stream, and Books Library.
 */

import {
  getTodayCommemoration,
  getFastingInfo,
  getUpcomingFeastsFrom,
} from './utils/liturgicalEngine';
import { SYNAX_TITLES } from './synaxTitles';

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

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface Env {
  DB: D1Database;
  AI?: { run(model: string, input: any): Promise<any> };
  BUNNY_LIBRARY_ID?: string;
  BUNNY_API_KEY?: string;
  BUNNY_STREAM_API_KEY?: string;
  BUNNY_CDN_HOST?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  GEMINI_API_KEY?: string;
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
  // Speed (2026-09-20): all idempotent CREATE TABLE / CREATE INDEX statements
  // go out in ONE D1 batch = one round trip, instead of ~12 sequential exec()
  // calls. Each D1 round trip costs 100-400ms and isolates recycle often on a
  // quiet site, so the sequential version added 2-5s to API calls on wake-up.
  try {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS churches ( id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT DEFAULT '', cover TEXT DEFAULT '', description TEXT DEFAULT '', address TEXT DEFAULT '', city TEXT DEFAULT '', country TEXT DEFAULT '', priest_name TEXT DEFAULT '', phone TEXT DEFAULT '', website TEXT DEFAULT '', service_times TEXT DEFAULT '', owner_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS follows ( follower_id TEXT NOT NULL, following_id TEXT NOT NULL, following_name TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (follower_id, following_id) )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows ( following_id )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS book_likes ( book_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (book_id, user_id) )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS book_comments ( id TEXT PRIMARY KEY, book_id TEXT NOT NULL, user_id TEXT NOT NULL, author_name TEXT, author_avatar TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS referral_codes ( code TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes ( user_id )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS synax_likes ( synax_key TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (synax_key, user_id) )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS synax_comments ( id TEXT PRIMARY KEY, synax_key TEXT NOT NULL, user_id TEXT NOT NULL, author_name TEXT, author_avatar TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS push_receipts ( push_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT (datetime('now')), received_at TEXT )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS post_translations ( post_id TEXT NOT NULL, lang TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (post_id, lang) )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_events_date ON events ( date )`),
    ]);
  } catch (schemaBatchErr) {
    console.warn('[ensureD1Tables] schema batch notice:', schemaBatchErr);
  }
    // Stories columns: older D1 databases were created before newer columns
    // existed, and CREATE TABLE IF NOT EXISTS never alters an existing table.
    // Must run BEFORE the giant batch below (which throws and skips everything
    // after it if its SQL is invalid).
    try {
      const requiredStoryCols: Array<[string, string]> = [
        ['author_id', 'TEXT'],
        ['author_name', "TEXT NOT NULL DEFAULT 'Orthodox Parishioner'"],
        ['author_avatar', "TEXT DEFAULT 'https://orthodoxconnect.live/launchericon-512x512.png'"],
        ['author_parish', "TEXT DEFAULT 'Orthodox Church'"],
        ['image_url', 'TEXT'],
        ['media_url', 'TEXT'],
        ['media_type', "TEXT DEFAULT 'image'"],
        ['caption', "TEXT DEFAULT ''"],
        ['expires_at', 'TEXT'],
        ['created_at', "TEXT NOT NULL DEFAULT (datetime('now'))"],
      ];
      for (const [colName, colDef] of requiredStoryCols) {
        try {
          await db.exec(`ALTER TABLE stories ADD COLUMN ${colName} ${colDef}`);
        } catch (colErr: any) {
          const colMsg = String((colErr && colErr.message) || colErr || '');
          if (!/duplicate column/i.test(colMsg) && !/no such table/i.test(colMsg)) {
            throw colErr;
          }
        }
      }
    } catch (storyMigErr) {
      console.warn('[ensureD1Tables] stories migration notice:', storyMigErr);
    }
    try {
      // Self-healing: some production databases have a stories table with a
      // bogus FOREIGN KEY (author_id) REFERENCES users(id). There is no users
      // table (the app uses profiles), so every story insert fails the FK
      // check. Rebuild the table without the FK, preserving existing rows.
      let fkRows: any[] = [];
      try {
        const r = await db.prepare('PRAGMA foreign_key_list(stories)').all();
        fkRows = (r && (r as any).results) || [];
      } catch (e) { fkRows = []; }
      const hasBogusFk = fkRows.some((r: any) => r && r.table === 'users');
      if (hasBogusFk) {
        await db.exec(`CREATE TABLE stories_fixed (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, author_name TEXT NOT NULL, author_avatar TEXT, author_parish TEXT DEFAULT 'Orthodox Church', image_url TEXT, media_url TEXT NOT NULL, media_type TEXT DEFAULT 'image', caption TEXT DEFAULT '', expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
        await db.exec(`INSERT INTO stories_fixed (id, author_id, author_name, author_avatar, author_parish, image_url, media_url, media_type, caption, expires_at, created_at) SELECT id, author_id, author_name, author_avatar, author_parish, image_url, media_url, media_type, caption, expires_at, created_at FROM stories`);
        await db.exec(`DROP TABLE stories`);
        await db.exec(`ALTER TABLE stories_fixed RENAME TO stories`);
      }
    } catch (storyFkFixErr) {
      console.warn('[ensureD1Tables] stories FK fix notice:', storyFkFixErr);
    }
    // call_signals newer columns (kept out of the giant batch as standalone
    // statements so one bad statement cannot break the whole batch).
    for (const colSql of [
      'ALTER TABLE call_signals ADD COLUMN sdp TEXT',
      'ALTER TABLE call_signals ADD COLUMN candidate TEXT',
      'ALTER TABLE call_signals ADD COLUMN meta TEXT',
    ]) {
      try {
        await db.exec(colSql);
      } catch (sigColErr: any) {
        const m = String((sigColErr && sigColErr.message) || sigColErr || '');
        if (!/duplicate column/i.test(m) && !/no such table/i.test(m)) {
          console.warn('[ensureD1Tables] call_signals column notice:', m);
        }
      }
    }
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS profiles ( id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, full_name TEXT NOT NULL DEFAULT 'Orthodox Parishioner', parish TEXT NOT NULL DEFAULT 'Orthodox Church', bio TEXT DEFAULT 'Orthodox Christian seeking fellowship and spiritual growth.', avatar_url TEXT DEFAULT 'https://orthodoxconnect.live/launchericon-512x512.png', role TEXT NOT NULL DEFAULT 'user', is_banned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS sessions ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS posts ( id TEXT PRIMARY KEY, content TEXT NOT NULL DEFAULT '', video_id TEXT, author_id TEXT, author_name TEXT DEFAULT 'Orthodox Parishioner', author_parish TEXT DEFAULT 'Orthodox Church', author_avatar TEXT DEFAULT 'https://orthodoxconnect.live/launchericon-512x512.png', image_url TEXT, group_id TEXT, likes_count INTEGER DEFAULT 0, comments_count INTEGER DEFAULT 0, reshares_count INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS post_likes ( post_id TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT, user_avatar TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (post_id, user_id) ); CREATE TABLE IF NOT EXISTS post_comments ( id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT, author_name TEXT DEFAULT 'Orthodox Parishioner', author_avatar TEXT DEFAULT 'https://orthodoxconnect.live/launchericon-512x512.png', content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS messages ( id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, sender_name TEXT, receiver_id TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', image_url TEXT, video_url TEXT, audio_url TEXT, is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS stories ( id TEXT PRIMARY KEY, author_id TEXT, author_name TEXT NOT NULL DEFAULT 'Orthodox Parishioner', author_avatar TEXT DEFAULT 'https://orthodoxconnect.live/launchericon-512x512.png', author_parish TEXT DEFAULT 'Orthodox Church', image_url TEXT NOT NULL, media_type TEXT DEFAULT 'image', caption TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS churches ( id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT DEFAULT '', cover TEXT DEFAULT '', description TEXT DEFAULT '', address TEXT DEFAULT '', city TEXT DEFAULT '', country TEXT DEFAULT '', priest_name TEXT DEFAULT '', phone TEXT DEFAULT '', website TEXT DEFAULT '', service_times TEXT DEFAULT '', owner_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS events ( id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', date TEXT NOT NULL, time TEXT DEFAULT '10:00 AM', location_type TEXT DEFAULT 'physical', location_address TEXT, virtual_link TEXT, category TEXT DEFAULT 'liturgy', parish TEXT DEFAULT 'Orthodox Parish', host_name TEXT DEFAULT 'Priest / Host', host_avatar TEXT, host_id TEXT, image_url TEXT, going_count INTEGER DEFAULT 1, interested_count INTEGER DEFAULT 0, rsvps TEXT DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS live_streams ( id TEXT PRIMARY KEY, title TEXT NOT NULL, host_parish TEXT DEFAULT 'Orthodox Church', priest_name TEXT DEFAULT 'Priest / Host', media_url TEXT NOT NULL, is_live INTEGER DEFAULT 1, viewers_count INTEGER DEFAULT 1, ended_at TEXT, replay_guid TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS content_reports ( id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, target_content_preview TEXT, target_author_name TEXT, target_author_id TEXT, reporter_id TEXT, reporter_name TEXT, reason TEXT DEFAULT 'inappropriate', details TEXT, status TEXT DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS notifications ( id TEXT PRIMARY KEY, recipient_id TEXT, actor_id TEXT, actor_name TEXT DEFAULT 'Orthodox Parishioner', actor_avatar TEXT, type TEXT NOT NULL DEFAULT 'system', title TEXT, body TEXT, post_id TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')) ); CREATE TABLE IF NOT EXISTS call_signals ( id TEXT PRIMARY KEY, call_id TEXT, sig_type TEXT, caller_id TEXT, caller_name TEXT, caller_avatar TEXT, target_user_id TEXT, call_type TEXT, sdp TEXT, candidate TEXT, meta TEXT, created_at INTEGER ); CREATE INDEX IF NOT EXISTS idx_call_signals_target ON call_signals(target_user_id, created_at); CREATE TABLE IF NOT EXISTS group_calls ( id TEXT PRIMARY KEY, room_id TEXT, room_name TEXT, host_id TEXT, host_name TEXT, started_at TEXT ); CREATE INDEX IF NOT EXISTS idx_group_calls_room ON group_calls(room_id, started_at); CREATE TABLE IF NOT EXISTS push_subscriptions ( user_id TEXT, endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, created_at TEXT DEFAULT (datetime('now')) ); CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id); CREATE TABLE IF NOT EXISTS books ( id TEXT PRIMARY KEY, title_ar TEXT NOT NULL, title_en TEXT, author_ar TEXT NOT NULL, author_en TEXT, category TEXT NOT NULL DEFAULT 'patristics', cover_image_url TEXT, file_url TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) );`);
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
      // Bunny Stream Live columns (true live streaming via Bunny Stream Live API)
      const requiredBunnyLiveCols: Array<[string, string]> = [
        ['bunny_stream_id', 'TEXT'],
        ['bunny_stream_key', 'TEXT'],
        ['playback_url_hls', 'TEXT'],
        ['status', "TEXT DEFAULT 'scheduled'"],
        ['description', 'TEXT'],
        ['scheduled_start_time', 'TEXT'],
        ['viewer_count', 'INTEGER DEFAULT 0'],
        ['started_at', 'TEXT'],
      ];
      for (const [colName, colDef] of requiredBunnyLiveCols) {
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
    } catch (bunnyLiveMigErr) {
      console.warn('[ensureD1Tables] live_streams bunny-live migration notice:', bunnyLiveMigErr);
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
  // RFC 8292 format: the push service needs the public key (k=) to verify the JWT.
  return 'vapid t=' + headerB64 + '.' + payloadB64 + '.' + b64uEncode(sig) + ', k=' + vapidPublic;
}

async function encryptPushPayload(p256dhB64: string, authB64: string, plaintext: Uint8Array): Promise<{ body: Uint8Array; saltB64: string; dhB64: string }> {
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
  // RFC 8188 header: salt(16) || rs(4) || idlen(1)=65 || keyid(65B ephemeral key) || ciphertext.
  // (A stray extra byte here once made every push undecryptable — browsers dropped them silently.)
  const body = concatBytes(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
  return { body, saltB64: b64uEncode(salt), dhB64: b64uEncode(asPublic) };
}

async function vapidPairValid(pub: string, priv: string): Promise<boolean> {
  try {
    const pubRaw = b64uDecode(pub);
    if (pubRaw.length !== 65 || pubRaw[0] !== 0x04 || !priv) return false;
    const x = b64uEncode(pubRaw.slice(1, 33));
    const y = b64uEncode(pubRaw.slice(33, 65));
    const privKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, d: priv } as any, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const msg = new TextEncoder().encode('vapid-pair-check');
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, msg);
    const pubKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y } as any, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, sig, msg);
  } catch (e) { return false; }
}

async function getVapidKeys(env: Env): Promise<{ publicKey: string; privateKey: string; subject: string }> {
  const subject = (env.VAPID_SUBJECT || 'mailto:admin@orthodoxconnect.live').trim();
  const envPub = (env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (env.VAPID_PRIVATE_KEY || '').trim();
  let d1Pub = '';
  let d1Priv = '';
  if (env.DB) {
    try {
      const pubRow: any = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'vapid_public'").first();
      const privRow: any = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'vapid_private'").first();
      if (pubRow?.value) d1Pub = String(pubRow.value).trim();
      if (privRow?.value) d1Priv = String(privRow.value).trim();
    } catch (e) {}
  }
  // A mixed public/private pair makes FCM answer 403 to every push, so only a
  // cryptographically valid pair is ever used. Env first, then D1.
  const candidates = [{ pub: envPub, priv: envPriv }, { pub: d1Pub, priv: d1Priv }];
  for (const c of candidates) {
    if (c.pub && c.priv && await vapidPairValid(c.pub, c.priv)) {
      return { publicKey: c.pub, privateKey: c.priv, subject };
    }
  }
  // Self-heal: no valid pair anywhere — generate a fresh one, store it in D1,
  // and use it. Clients fetch the current public key from
  // /api/push/vapid-public-key and resubscribe when it changes.
  try {
    const kp: any = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    const privJwk: any = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pub = b64uEncode(pubRaw);
    const priv = String(privJwk.d || '');
    if (pub && priv && env.DB) {
      try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)').run(); } catch (e) {}
      const now = new Date().toISOString();
      await env.DB.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('vapid_public', ?, ?)").bind(pub, now).run();
      await env.DB.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('vapid_private', ?, ?)").bind(priv, now).run();
    }
    if (pub && priv) return { publicKey: pub, privateKey: priv, subject };
  } catch (e) { console.warn('[push] vapid self-heal failed:', (e as any)?.message || e); }
  return { publicKey: envPub || d1Pub, privateKey: envPriv || d1Priv, subject };
}

async function sendWebPush(env: Env, sub: { endpoint: string; p256dh: string; auth: string }, payload: any): Promise<boolean> {
  try {
    const { publicKey: vapidPublic, privateKey: vapidPrivate, subject } = await getVapidKeys(env);
    if (!vapidPublic || !vapidPrivate) {
      console.warn('[push] VAPID keys not configured; skipping push');
      (globalThis as any).__lastPushStatus = 'no-vapid-keys';
      return false;
    }
    const enc = await encryptPushPayload(sub.p256dh, sub.auth, new TextEncoder().encode(JSON.stringify(payload)));
    const authHeader = await createVapidAuthHeader(sub.endpoint, subject, vapidPublic, vapidPrivate);
    // Bound the push-service fetch: a hung FCM must not hang the worker (or the caller's connection).
    const pushCtrl = new AbortController();
    const pushTimer = setTimeout(() => pushCtrl.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'TTL': '120',
          'Content-Type': 'application/octet-stream',
          // RFC 8291 aes128gcm: the browser needs the salt + ephemeral key as headers to decrypt.
          'Content-Encoding': 'aes128gcm',
          'Encryption': 'salt=' + enc.saltB64,
          'Crypto-Key': 'dh=' + enc.dhB64,
          'Authorization': authHeader,
        },
        body: enc.body as any,
        signal: pushCtrl.signal,
      });
    } finally {
      clearTimeout(pushTimer);
    }
    (globalThis as any).__lastPushStatus = res.status;
    try { (globalThis as any).__lastPushBody = (await res.text()).slice(0, 300); } catch (e) { (globalThis as any).__lastPushBody = ''; }
    if (!res.ok && (res.status === 400 || res.status === 404 || res.status === 410)) {
      // 400 = bad request (e.g. subscription created with a different VAPID key);
      // 404/410 = subscription gone. All are dead — remove so they can't linger.
      try { await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run(); } catch (e) {}
    }
    return res.ok;
  } catch (e) {
    console.warn('[push] send failed:', (e as any)?.message || e);
    (globalThis as any).__lastPushStatus = 'exception: ' + ((e as any)?.message || e);
    return false;
  }
}

// Verified identity: the ONLY trusted source of "who is calling".
// Resolves the session token (query ?token= or Authorization: Bearer header)
// against the D1 sessions table and loads the user's verified id/email/role.
// Client-supplied x-user-* headers are NEVER trusted: they are trivially
// spoofable and previously allowed full account impersonation.
export async function getAuthIdentity(request: Request, env: Env) {
  const anon = { email: '', role: '', id: '', bearerToken: '', isSuperAdmin: false, isAdmin: false };
  try {
    const url = new URL(request.url);
    let token = (url.searchParams.get('token') || '').trim();
    if (!token) {
      const h = request.headers.get('Authorization') || request.headers.get('authorization') || '';
      if (h.startsWith('Bearer ')) token = h.substring(7).trim();
    }
    if (!token || !env || !env.DB) return anon;
    const sess = await env.DB.prepare(
      'SELECT user_id, expires_at FROM sessions WHERE token = ?'
    ).bind(token).first<{ user_id: string; expires_at: string | null }>();
    if (!sess || !sess.user_id) return anon;
    // Long-lived login: sessions last a year and silently renew while the app
    // is used, so the app "just opens". A token expired up to 30 days ago is
    // still accepted once (grace) and then renewed.
    const nowMs = Date.now();
    const GRACE_MS = 30 * 24 * 3600 * 1000;
    const expMs = sess.expires_at ? Date.parse(sess.expires_at) : NaN;
    const stillValid = !sess.expires_at || isNaN(expMs) || expMs > nowMs - GRACE_MS;
    if (!stillValid) return anon;
    if (!sess.expires_at || isNaN(expMs) || expMs < nowMs + GRACE_MS) {
      const newExp = new Date(nowMs + 365 * 24 * 3600 * 1000).toISOString();
      try {
        await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').bind(newExp, token).run();
      } catch (e) {}
    }
    const p = await env.DB.prepare('SELECT id, email, role FROM profiles WHERE id = ?')
      .bind(sess.user_id)
      .first<{ id: string; email: string | null; role: string | null }>();
    if (!p || !p.id) return anon;
    const email = (p.email || '').trim().toLowerCase();
    const role = (p.role || '').trim().toLowerCase();
    const isSuperAdmin = email === SUPER_ADMIN_EMAIL || role === 'super_admin';
    const isAdmin = isSuperAdmin || role === 'admin' || role === 'owner';
    return { email, role, id: p.id, bearerToken: token, isSuperAdmin, isAdmin };
  } catch (e) {
    return anon;
  }
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

// --- Post translation cache (per Worker isolate) ---
const translateCache = new Map<string, { text: string; src: string | null }>();

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Translate one chunk of text. Primary: Cloudflare Workers AI (Llama 3.1 8B instruct)
// (official, no key). Backup: Google's free endpoint. Returns the
// translated text and the detected source language.
// Collapse degenerate repetition loops (same sentence 3+ times in a row)
// that small translation models sometimes produce on long inputs.
function collapseRepeats(s: string): string {
  const parts = s.split(/(?<=[.!?؟…])\s+/);
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    const n = out.length;
    if (n >= 2 && out[n - 1] === t && out[n - 2] === t) continue;
    out.push(t);
  }
  return out.join(' ');
}

async function translateChunk(chunk: string, target: string, env: any): Promise<{ text: string; src: string | null }> {
  const arabicChars = (chunk.match(/[\u0600-\u06FF]/g) || []).length;
  const looksArabic = chunk.length > 0 && arabicChars > chunk.length * 0.3;
  const srcName = looksArabic ? 'Arabic' : 'English';
  const tgtName = target === 'ar' ? 'Arabic' : 'English';
  try {
    if (env && env.AI) {
      const out: any = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content:
              'You are a professional ' + srcName + '-to-' + tgtName + ' translator. ' +
              'Output ONLY the translation — no explanations, no preamble, no quotation marks around it. ' +
              'Translate faithfully and naturally; do not repeat sentences.',
          },
          { role: 'user', content: chunk },
        ],
      });
      let t = String((out && out.response) || '').trim();
      t = collapseRepeats(t);
      if (t) return { text: t, src: looksArabic ? 'ar' : 'en' };
    }
  } catch (e) {
    /* fall through to backup */
  }
  const upstream =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
    encodeURIComponent(target) +
    '&dt=t&q=' +
    encodeURIComponent(chunk);
  const resp = await fetch(upstream, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error('translate upstream ' + resp.status);
  const data: any = await resp.json();
  const sentences = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  const text = sentences.map((s: any) => (s && typeof s[0] === 'string' ? s[0] : '')).join('');
  const src = typeof data[2] === 'string' ? data[2] : null;
  return { text, src };
}

// Translate a full post text: splits into small sentence packs (translation
// models can degenerate — repeat one sentence — when fed long inputs), then
// reassembles with paragraph breaks restored.
async function translateTextFull(text: string, target: 'ar' | 'en', env: any): Promise<{ text: string; src: string | null }> {
  const chunks: string[] = [];
  const paraEnds: number[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const sentences = para.match(/[^.!?؟…\n]+[.!?؟…\n]*/g) || [para];
    let cur = '';
    const flush = () => {
      if (cur) {
        chunks.push(cur);
        cur = '';
      }
    };
    for (const s of sentences) {
      let piece = s.trim();
      if (!piece) continue;
      // Hard-split any single overlong sentence into 500-char slices.
      while (piece.length > 500) {
        const slice = piece.slice(0, 500);
        const cand = cur ? cur + ' ' + slice : slice;
        if (cand.length > 500 && cur) {
          flush();
          cur = slice;
        } else {
          cur = cand;
        }
        piece = piece.slice(500).trim();
      }
      if (!piece) continue;
      const cand = cur ? cur + ' ' + piece : piece;
      if (cand.length > 500 && cur) {
        flush();
        cur = piece;
      } else {
        cur = cand;
      }
    }
    flush();
    paraEnds.push(chunks.length);
  }
  if (!chunks.length) throw new Error('nothing to translate');

  const translatedChunks: string[] = [];
  let detectedSource: string | null = null;
  for (const chunk of chunks) {
    const r = await translateChunk(chunk, target, env);
    translatedChunks.push(r.text);
    if (!detectedSource && r.src) detectedSource = r.src;
  }
  // Reassemble: packs within a paragraph join with spaces, paragraphs
  // join with blank lines.
  const paragraphs: string[] = [];
  let start = 0;
  for (const end of paraEnds) {
    const parts = translatedChunks.slice(start, end).filter((p) => p.trim());
    if (parts.length) paragraphs.push(parts.join(' '));
    start = end;
  }
  const translatedText = paragraphs.join('\n\n').trim();
  if (!translatedText) throw new Error('empty translation');
  return { text: translatedText, src: detectedSource };
}

// Detect a text's dominant language: 'ar', 'en', or null (mixed/unknown).
function detectDominantLang(text: string): 'ar' | 'en' | null {
  const t = (text || '').trim();
  if (t.length < 3) return null;
  const arabicChars = (t.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabicChars > t.length * 0.3) return 'ar';
  if (/[A-Za-z]/.test(t)) return 'en';
  return null;
}

// Background job: translate a new post into the other language once and
// store it in post_translations, so every reader gets it instantly.
async function pretranslatePost(postId: string, content: string, env: any): Promise<void> {
  try {
    if (!postId || !env || !env.DB) return;
    const text = (content || '').trim();
    const src = detectDominantLang(text);
    if (!src) return;
    const target = src === 'ar' ? 'en' : 'ar';
    const existing = await env.DB.prepare(
      'SELECT post_id FROM post_translations WHERE post_id = ? AND lang = ?'
    ).bind(postId, target).first();
    if (existing) return;
    const { text: translated } = await translateTextFull(text, target, env);
    if (translated && translated.trim()) {
      await env.DB.prepare(
        'INSERT OR REPLACE INTO post_translations (post_id, lang, content) VALUES (?, ?, ?)'
      ).bind(postId, target, translated).run();
    }
  } catch (e) {
    console.warn('[pretranslatePost] notice:', e);
  }
}

// Extract a YouTube video id from youtu.be / youtube.com URLs, or null.
function extractYouTubeId(input: any): string | null {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  let m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

// Use an image URL only if it is a real remote URL (never inline data: URIs,
// which can be hundreds of KB of base64 and break link-preview scrapers).
function safeImgUrl(input: any, fallback: string): string {
  const s = String(input || '').trim();
  if (/^https?:\/\//i.test(s) && s.length < 2000) return s;
  return fallback;
}

function escHtml(s: any): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Public share page for a post, live stream, book, or synaxarium day:
// /post/:id, /live/:id, /book/:id, /synax/:MM-DD.
// Crawlers (WhatsApp, Facebook) read the OG tags; humans see a preview
// with a CTA that opens it in the app. No login required.
const COPTIC_MONTHS_EN = [
  'Tout', 'Baba', 'Hator', 'Kiahk', 'Toba', 'Amshir',
  'Baramhat', 'Baramouda', 'Bashans', 'Paona', 'Epep', 'Mesra', 'Nasie',
];
// Cache of the static synaxarium month JSON files, fetched on demand so the
// public /synax/MM-DD share pages can show the day's full story text.
const synaxMonthCache: Record<string, any> = {};
async function getSynaxMonthJson(mm: string): Promise<any | null> {
  if (synaxMonthCache[mm]) return synaxMonthCache[mm];
  try {
    const r = await fetch('https://orthodoxconnect.live/synaxarium/' + mm + '.json');
    if (!r.ok) return null;
    const j = await r.json();
    synaxMonthCache[mm] = j;
    return j;
  } catch (e) { return null; }
}
async function renderSharePage(db: D1Database, kind: string, id: string): Promise<Response> {
  const APP_URL = 'https://orthodoxconnect.live';
  const PLAY_URL = 'https://play.google.com/store/apps/details?id=orthodoxconnect.live';
  const DEFAULT_IMG = APP_URL + '/launchericon-512x512.png';

  let title = 'OrthodoxConnect';
  let desc = 'Faith · Fellowship · Community';
  let image = DEFAULT_IMG;
  let imageW = '512';
  let imageH = '512';
  let bodyHtml = '';
  let appLink = APP_URL + '/';
  let found = false;

  try {
    if (kind === 'live') {
      const s = await db.prepare(
        'SELECT id, title, host_parish, priest_name, is_live, viewers_count, created_at FROM live_streams WHERE id = ?'
      ).bind(id).first<any>();
      if (s) {
        found = true;
        const live = Number(s.is_live) === 1;
        title = String(s.title || 'Live broadcast') + ' — OrthodoxConnect';
        desc = `${s.priest_name || 'Orthodox Church'} · ${s.host_parish || ''}`.trim();
        appLink = APP_URL + '/?live=' + encodeURIComponent(String(s.id));
        bodyHtml = `
          <div class="badge ${live ? 'live' : ''}">${live ? '● LIVE' : 'Broadcast'}</div>
          <h1>${escHtml(s.title || 'Live broadcast')}</h1>
          <p class="meta">${escHtml(s.priest_name || '')} · ${escHtml(s.host_parish || 'Orthodox Church')}</p>
          ${live ? `<p class="meta">🔴 ${escHtml(String(s.viewers_count || 1))} watching now</p>` : ''}`;
      }
    } else if (kind === 'book') {
      const b = await db.prepare(
        'SELECT id, title_ar, title_en, author_ar, author_en, category, description, cover_image_url FROM books WHERE id = ?'
      ).bind(id).first<any>();
      if (b) {
        found = true;
        const bTitle = String(b.title_ar || b.title_en || 'Book');
        const bAuthor = String(b.author_ar || b.author_en || '');
        const isAudio = b.category === 'audiobook';
        const bDesc = String(b.description || '').slice(0, 200);
        title = `${bTitle} — OrthodoxConnect Library`;
        desc = bAuthor + (bDesc ? ` · ${bDesc}` : '') || 'A book from the OrthodoxConnect library.';
        const cover = safeImgUrl(b.cover_image_url, '');
        image = cover || DEFAULT_IMG;
        if (cover) { imageW = '1200'; imageH = '630'; }
        appLink = APP_URL + '/?book=' + encodeURIComponent(String(b.id));
        bodyHtml = `
          <div class="badge">${isAudio ? '&#127911; Audiobook' : '&#128214; Book'}</div>
          <h1>${escHtml(bTitle)}</h1>
          ${bAuthor ? `<p class="meta">${escHtml(bAuthor)}</p>` : ''}
          ${cover ? `<img class="media" src="${escHtml(cover)}" alt="Book cover" onerror="this.style.display='none'"/>` : ''}
          ${bDesc ? `<p class="content">${escHtml(bDesc)}</p>` : ''}
          <div class="meta">&#128214; OrthodoxConnect Library</div>`;
      }
    } else if (kind === 'synax') {
      // Synaxarium day share: id is "MM-DD" (Coptic month/day). Uses the real
      // day titles baked in at build time (src/synaxTitles.ts).
      const m = /^(\d{2})-(\d{2})$/.exec(String(id || ''));
      if (m) {
        const mo = Number(m[1]), da = Number(m[2]);
        const valid = mo >= 1 && mo <= 13 && da >= 1 && (mo === 13 ? da <= 6 : da <= 30);
        const dayTitles = valid ? SYNAX_TITLES[String(id)] : undefined;
        if (valid && dayTitles) {
          found = true;
          const dateLabel = `${da} ${COPTIC_MONTHS_EN[mo - 1]}`;
          const arTitles = dayTitles.ar || [];
          const enTitles = dayTitles.en || [];
          const mainTitle = arTitles[0] || enTitles[0] || 'Daily Synaxarium';
          const extra = Math.max(arTitles.length, enTitles.length) - 1;
          title = `${mainTitle} — OrthodoxConnect`;
          const teaser = dayTitles.teaser_ar || dayTitles.teaser_en || '';
          const rtl = arTitles.length > 0 ? ' dir="rtl" style="text-align:right"' : '';
          desc = teaser
            || (`The saints, martyrs, and commemorations of ${dateLabel} — full text in English and Arabic.`);
          image = APP_URL + '/synax-share.png';
          imageW = '2240';
          imageH = '1120';
          appLink = APP_URL + '/?synax=' + encodeURIComponent(String(id));
          const titleList = (arTitles.length ? arTitles : enTitles)
            .map((t) => `<p class="content"${rtl}>• ${escHtml(t)}</p>`).join('');
          // Full story text: fetch the static month JSON (cached per isolate)
          // so visitors can read the whole day right on the share page.
          let storyHtml = '';
          try {
            const monthJson = await getSynaxMonthJson(m[1]);
            const entry = monthJson ? monthJson[String(da)] : null;
            const fullText = String((entry && (entry.ar_text || entry.text)) || '');
            if (fullText) {
              storyHtml = fullText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
                .map((p) => `<p class="content"${rtl}>${escHtml(p)}</p>`).join('');
            }
          } catch (e) {}
          // Prev / next day navigation (Coptic calendar: 12x30 + 6 epagomenal days).
          const monthLen = (x: number) => (x === 13 ? 6 : 30);
          let pMo = mo, pDa = da - 1;
          if (pDa < 1) { pMo = mo === 1 ? 13 : mo - 1; pDa = monthLen(pMo); }
          let nMo = mo, nDa = da + 1;
          if (nDa > monthLen(mo)) { nMo = mo === 13 ? 1 : mo + 1; nDa = 1; }
          const pad2 = (x: number) => String(x).padStart(2, '0');
          const navHtml = `<div class="synax-nav">`
            + `<a href="/synax/${pad2(pMo)}-${pad2(pDa)}">← ${escHtml(pDa + ' ' + COPTIC_MONTHS_EN[pMo - 1])}</a>`
            + `<a href="/synax/${pad2(nMo)}-${pad2(nDa)}">${escHtml(nDa + ' ' + COPTIC_MONTHS_EN[nMo - 1])} →</a></div>`;
          bodyHtml = `
          <div class="badge">📖 Synaxarium</div>
          <h1${rtl}>${escHtml(mainTitle)}</h1>
          <p class="meta">${escHtml(dateLabel)} · Coptic calendar</p>
          ${titleList}
          ${storyHtml || (teaser ? `<p class="content"${rtl}>${escHtml(teaser)}</p>` : '')}
          ${navHtml}
          <div class="meta">📖 OrthodoxConnect Synaxarium</div>`;
        }
      }
    } else {
      const p = await db.prepare(
        'SELECT id, content, video_id, author_name, author_parish, author_avatar, image_url, likes_count, comments_count, created_at FROM posts WHERE id = ?'
      ).bind(id).first<any>();
      if (p) {
        found = true;
        const text = String(p.content || '');
        const ytId = extractYouTubeId(p.video_id);
        const rawImg = String(p.image_url || '');
        const isDataImg = /^data:image\//i.test(rawImg);
        const dataImgUrl = APP_URL + '/post-image/' + encodeURIComponent(String(p.id));
        const postImg = ytId
          ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
          : isDataImg
            ? dataImgUrl
            : safeImgUrl(p.image_url, DEFAULT_IMG);
        if (ytId) { imageW = '480'; imageH = '360'; }
        title = `${p.author_name || 'Orthodox Parishioner'} on OrthodoxConnect`;
        if (text) {
          desc = text.length > 200 ? text.slice(0, 200) + '…' : text;
        } else if (ytId) {
          desc = '🎬 Shared a video on OrthodoxConnect';
        } else {
          desc = 'A post from the OrthodoxConnect parish feed.';
        }
        image = postImg;
        if (!ytId && postImg !== DEFAULT_IMG) { imageW = '1200'; imageH = '630'; }
        appLink = APP_URL + '/?post=' + encodeURIComponent(String(p.id));
        const dateStr = p.created_at ? new Date(String(p.created_at)).toLocaleDateString() : '';
        const avatarSrc = safeImgUrl(p.author_avatar, DEFAULT_IMG);
        bodyHtml = `
          <div class="author">
            <img class="avatar" src="${escHtml(avatarSrc)}" alt="" onerror="this.style.display='none'"/>
            <div>
              <div class="author-name">${escHtml(p.author_name || 'Orthodox Parishioner')}</div>
              <div class="meta">${escHtml(p.author_parish || 'Orthodox Church')}${dateStr ? ' · ' + escHtml(dateStr) : ''}</div>
            </div>
          </div>
          ${text ? `<p class="content">${escHtml(text)}</p>` : ''}
          ${ytId ? `<a href="${escHtml(appLink)}"><img class="media" src="${escHtml(postImg)}" alt="Video thumbnail"/></a>` : ''}
          ${!ytId && (isDataImg || safeImgUrl(p.image_url, '')) ? `<img class="media" src="${escHtml(isDataImg ? dataImgUrl : safeImgUrl(p.image_url, DEFAULT_IMG))}" alt="Post image" onerror="this.style.display='none'"/>` : ''}
          <div class="meta">❤ ${escHtml(String(p.likes_count || 0))} &nbsp; 💬 ${escHtml(String(p.comments_count || 0))}</div>`;
      }
    }
  } catch (e) {}

  if (!bodyHtml) {
    bodyHtml = `<h1>OrthodoxConnect</h1><p class="meta">This post is no longer available.</p>`;
  }

  const pageUrl = APP_URL + (kind === 'live' ? '/live/' : kind === 'book' ? '/book/' : kind === 'synax' ? '/synax/' : '/post/') + encodeURIComponent(id);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escHtml(title)}</title>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="OrthodoxConnect"/>
<meta property="og:title" content="${escHtml(title)}"/>
<meta property="og:description" content="${escHtml(desc)}"/>
<meta property="og:image" content="${escHtml(image)}"/>
<meta property="og:image:width" content="${imageW}"/>
<meta property="og:image:height" content="${imageH}"/>
<meta property="og:image:alt" content="${escHtml(title)}"/>
<meta property="og:url" content="${escHtml(pageUrl)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escHtml(title)}"/>
<meta name="twitter:description" content="${escHtml(desc)}"/>
<meta name="twitter:image" content="${escHtml(image)}"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #f3e9d2; color: #3a2c1a; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 24px 16px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .brand img { width: 44px; height: 44px; border-radius: 12px; }
  .brand span { font-size: 20px; font-weight: bold; color: #7a5c2e; }
  .card { width: 100%; max-width: 560px; background: #fffdf6; border: 2px solid #c9a227; border-radius: 20px; padding: 22px; box-shadow: 0 8px 30px rgba(122,92,46,.18); }
  .author { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #c9a227; }
  .author-name { font-weight: bold; font-size: 16px; }
  .meta { font-size: 13px; color: #8a6d3b; margin-top: 2px; }
  h1 { font-size: 22px; margin-bottom: 8px; color: #3a2c1a; }
  .content { font-size: 16px; line-height: 1.65; white-space: pre-wrap; word-wrap: break-word; margin: 12px 0; }
  .media { width: 100%; border-radius: 14px; margin-top: 10px; border: 1px solid #e0c987; }
  .badge { display: inline-block; font-size: 12px; font-weight: bold; letter-spacing: 1px; padding: 5px 12px; border-radius: 20px; background: #7a5c2e; color: #fff; margin-bottom: 10px; }
  .badge.live { background: #b91c1c; }
  .cta { width: 100%; max-width: 560px; margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
  .btn { display: block; text-align: center; text-decoration: none; font-weight: bold; font-size: 17px; padding: 15px; border-radius: 16px; }
  .btn-primary { background: #7a5c2e; color: #fff; box-shadow: 0 4px 14px rgba(122,92,46,.35); }
  .btn-secondary { background: transparent; color: #7a5c2e; border: 2px solid #7a5c2e; }
  .synax-nav { display: flex; justify-content: space-between; margin-top: 14px; }
  .synax-nav a { color: #7a5c2e; font-weight: bold; text-decoration: none; font-size: 15px; }
  .foot { margin-top: 18px; font-size: 12px; color: #8a6d3b; text-align: center; }
</style>
</head>
<body>
  <div class="brand"><img src="${DEFAULT_IMG}" alt="OrthodoxConnect"/><span>OrthodoxConnect</span></div>
  <div class="card">${bodyHtml}</div>
  <div class="cta">
    <a class="btn btn-primary" href="${escHtml(appLink)}">Open in OrthodoxConnect</a>
    <a class="btn btn-secondary" href="${PLAY_URL}">Get the App</a>
  </div>
  <p class="foot">Faith · Fellowship · Community</p>
</body>
</html>`;
  return new Response(html, {
    status: found ? 200 : 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
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

// ---------------------------------------------------------------------------
// OrthodoxConnect Community Bots — clearly-labeled automated daily posts.
// ---------------------------------------------------------------------------
// These are OFFICIAL bots, never humans in disguise:
// - every bot profile id starts with "bot-"
// - display names carry a 🤖 and bios state "I am not a human"
// - the frontend renders a BOT badge next to the name (see PostCard.tsx)
// A daily cron trigger (wrangler.toml [triggers]) runs runCommunityBots().
// Post ids embed the date (botpost-<botid>-YYYY-MM-DD) so re-runs and
// manual seeds are idempotent.

interface CommunityBotDef {
  id: string;
  name: string;
  parish: string;
  bio: string;
  avatar: string;
}

const COMMUNITY_BOTS: CommunityBotDef[] = [
  {
    id: 'bot-daily-verse',
    name: 'Daily Verse 🤖',
    parish: 'OrthodoxConnect',
    bio: 'Official OrthodoxConnect bot 🤖 — I post one Bible verse every morning. I am not a human.',
    avatar:
      'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'bot-saint-of-day',
    name: 'Saint of the Day 🤖',
    parish: 'OrthodoxConnect',
    bio: 'Official OrthodoxConnect bot 🤖 — I share one saint story every morning. I am not a human.',
    avatar:
      'https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'bot-church-calendar',
    name: 'Church Calendar 🤖',
    parish: 'OrthodoxConnect',
    bio: 'Official OrthodoxConnect bot 🤖 — feasts, fasts and liturgical reminders. I am not a human.',
    avatar:
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=200',
  },
];

interface VerseItem {
  en: string;
  ar: string;
  refEn: string;
  refAr: string;
}

const DAILY_VERSES: VerseItem[] = [
  {
    en: 'For God so loved the world that He gave His only begotten Son, that whoever believes in Him should not perish but have everlasting life.',
    ar: 'لأنه هكذا أحب الله العالم حتى بذل ابنه الوحيد، لكي لا يهلك كل من يؤمن به بل تكون له الحياة الأبدية.',
    refEn: 'John 3:16',
    refAr: 'يوحنا 3:16',
  },
  {
    en: 'I can do all things through Christ who strengthens me.',
    ar: 'أستطيع كل شيء في المسيح الذي يقويني.',
    refEn: 'Philippians 4:13',
    refAr: 'فيلبي 4:13',
  },
  {
    en: 'The Lord is my shepherd; I shall not want.',
    ar: 'الرب راعيّ فلا يعوزني شيء.',
    refEn: 'Psalm 23:1',
    refAr: 'مزمور 23:1',
  },
  {
    en: 'And we know that all things work together for good to those who love God.',
    ar: 'ونحن نعلم أن كل الأشياء تعمل معاً للخير للذين يحبون الله.',
    refEn: 'Romans 8:28',
    refAr: 'رومية 8:28',
  },
  {
    en: 'Trust in the Lord with all your heart, and lean not on your own understanding.',
    ar: 'توكل على الرب بكل قلبك، وعلى فهمك لا تعتمد.',
    refEn: 'Proverbs 3:5',
    refAr: 'أمثال 3:5',
  },
  {
    en: 'Fear not, for I am with you; be not dismayed, for I am your God.',
    ar: 'لا تخف لأني معك، لا تتلفت لأني إلهك.',
    refEn: 'Isaiah 41:10',
    refAr: 'إشعياء 41:10',
  },
  {
    en: 'Come to Me, all you who labor and are heavy laden, and I will give you rest.',
    ar: 'تعالوا إليّ يا جميع المتعبين والثقيلي الأحمال، وأنا أريحكم.',
    refEn: 'Matthew 11:28',
    refAr: 'متى 11:28',
  },
  {
    en: 'God is our refuge and strength, a very present help in trouble.',
    ar: 'الله لنا ملجأ وقوة، عوناً في الضيقات وُجد شديداً.',
    refEn: 'Psalm 46:1',
    refAr: 'مزمور 46:1',
  },
  {
    en: 'Be strong and of good courage; do not be afraid, for the Lord your God is with you wherever you go.',
    ar: 'تشدد وتشجع، لا ترهب ولا ترتعب، لأن الرب إلهك معك حيثما تذهب.',
    refEn: 'Joshua 1:9',
    refAr: 'يشوع 1:9',
  },
  {
    en: 'Now may the God of hope fill you with all joy and peace in believing.',
    ar: 'وليملأكم إله الرجاء كل فرح وسلام في الإيمان.',
    refEn: 'Romans 15:13',
    refAr: 'رومية 15:13',
  },
  {
    en: 'Your word is a lamp to my feet and a light to my path.',
    ar: 'سراج لرجلي كلامك ونور لسبيلي.',
    refEn: 'Psalm 119:105',
    refAr: 'مزمور 119:105',
  },
  {
    en: 'Let your light so shine before men, that they may see your good works and glorify your Father in heaven.',
    ar: 'فليضئ نوركم هكذا قدام الناس، لكي يروا أعمالكم الحسنة ويمجدوا أباكم الذي في السماوات.',
    refEn: 'Matthew 5:16',
    refAr: 'متى 5:16',
  },
  {
    en: 'Let all that you do be done with love.',
    ar: 'لتكن كل أموركم في محبة.',
    refEn: '1 Corinthians 16:14',
    refAr: 'كورنثوس الأولى 16:14',
  },
  {
    en: 'Delight yourself also in the Lord, and He shall give you the desires of your heart.',
    ar: 'تلذذ بالرب فيعطيك سؤل قلبك.',
    refEn: 'Psalm 37:4',
    refAr: 'مزمور 37:4',
  },
  {
    en: 'But those who wait on the Lord shall renew their strength; they shall mount up with wings like eagles.',
    ar: 'وأما منتظرو الرب فيجددون قوة، يرفعون أجنحة كالنسور.',
    refEn: 'Isaiah 40:31',
    refAr: 'إشعياء 40:31',
  },
  {
    en: 'Peace I leave with you, My peace I give to you; not as the world gives do I give to you.',
    ar: 'سلاماً أترك لكم، سلامي أعطيكم، ليس كما يعطي العالم أعطيكم أنا.',
    refEn: 'John 14:27',
    refAr: 'يوحنا 14:27',
  },
  {
    en: 'Be anxious for nothing, but in everything by prayer and supplication, with thanksgiving, let your requests be made known to God.',
    ar: 'لا تهتموا بشيء، بل في كل شيء بالصلاة والدعاء مع الشكر، لتُعلم طلباتكم لدى الله.',
    refEn: 'Philippians 4:6',
    refAr: 'فيلبي 4:6',
  },
  {
    en: 'Oh, taste and see that the Lord is good; blessed is the man who trusts in Him!',
    ar: 'ذوقوا وانظروا ما أطيب الرب! طوبى للرجل المتوكل عليه.',
    refEn: 'Psalm 34:8',
    refAr: 'مزمور 34:8',
  },
  {
    en: 'He has shown you, O man, what is good; and what does the Lord require of you but to do justly, to love mercy, and to walk humbly with your God?',
    ar: 'قد أخبرك أيها الإنسان ما هو صالح، وماذا يطلب منك الرب إلا أن تصنع الحق وتحب الرحمة وتسلك متواضعاً مع إلهك.',
    refEn: 'Micah 6:8',
    refAr: 'ميخا 6:8',
  },
  {
    en: 'But seek first the kingdom of God and His righteousness, and all these things shall be added to you.',
    ar: 'لكن اطلبوا أولاً ملكوت الله وبره، وهذه كلها تُزاد لكم.',
    refEn: 'Matthew 6:33',
    refAr: 'متى 6:33',
  },
  {
    en: 'Cast your burden on the Lord, and He shall sustain you.',
    ar: 'ألق على الرب همك فهو يعولك.',
    refEn: 'Psalm 55:22',
    refAr: 'مزمور 55:22',
  },
  {
    en: 'For God has not given us a spirit of fear, but of power and of love and of a sound mind.',
    ar: 'لأن الله لم يعطنا روح الفشل، بل روح القوة والمحبة والنصح.',
    refEn: '2 Timothy 1:7',
    refAr: 'تيموثاوس الثانية 1:7',
  },
  {
    en: 'Now faith is the substance of things hoped for, the evidence of things not seen.',
    ar: 'وأما الإيمان فهو الثقة بما يُرجى والإيقان بأمور لا تُرى.',
    refEn: 'Hebrews 11:1',
    refAr: 'عبرانيين 11:1',
  },
  {
    en: 'He who dwells in the secret place of the Most High shall abide under the shadow of the Almighty.',
    ar: 'الساكن في ستر العلي، في ظل القدير يبيت.',
    refEn: 'Psalm 91:1',
    refAr: 'مزمور 91:1',
  },
  {
    en: 'If any of you lacks wisdom, let him ask of God, who gives to all liberally.',
    ar: 'وإنما إن كان أحدكم تعوزه حكمة، فليطلب من الله الذي يعطي الجميع بسخاء.',
    refEn: 'James 1:5',
    refAr: 'يعقوب 1:5',
  },
  {
    en: 'We love Him because He first loved us.',
    ar: 'نحن نحبه لأنه هو أحبنا أولاً.',
    refEn: '1 John 4:19',
    refAr: 'يوحنا الأولى 4:19',
  },
  {
    en: 'This is the day the Lord has made; we will rejoice and be glad in it.',
    ar: 'هذا هو اليوم الذي صنعه الرب، نبتهج ونفرح فيه.',
    refEn: 'Psalm 118:24',
    refAr: 'مزمور 118:24',
  },
  {
    en: 'And whatever you do, do it heartily, as to the Lord and not to men.',
    ar: 'وكل ما فعلتم، فاعملوا من القلب، كما للرب ليس للناس.',
    refEn: 'Colossians 3:23',
    refAr: 'كولوسي 3:23',
  },
  {
    en: "Through the Lord's mercies we are not consumed, because His compassions fail not. They are new every morning; great is Your faithfulness.",
    ar: 'إنه من إحسانات الرب أننا لم نفن، لأن مراحمه لا تزول. هي جديدة في كل صباح. عظيمة أمانتك.',
    refEn: 'Lamentations 3:22-23',
    refAr: 'مراثي إرميا 3:22-23',
  },
  {
    en: 'And God will wipe away every tear from their eyes; there shall be no more death, nor sorrow, nor crying.',
    ar: 'وسيمسح الله كل دمعة من عيونهم، والموت لا يكون فيما بعد، ولا يكون حزن ولا صراخ.',
    refEn: 'Revelation 21:4',
    refAr: 'رؤيا 21:4',
  },
];

interface SaintItem {
  en: string;
  ar: string;
}

const SAINTS_OF_DAY: SaintItem[] = [
  {
    en: 'St. Mary the Theotokos — the Mother of God and our loving intercessor in heaven.',
    ar: 'السيدة العذراء مريم والدة الإله — أمنا وشفيعتنا في السماء.',
  },
  {
    en: 'St. Anthony the Great — left everything to follow Christ in the desert and became the father of monasticism.',
    ar: 'القديس أنطونيوس الكبير — ترك كل شيء وتبع المسيح في البرية، فصار أب الرهبنة.',
  },
  {
    en: 'St. Athanasius the Apostolic — the fearless defender of the faith against Arianism.',
    ar: 'القديس أثناسيوس الرسولي — المدافع الشجاع عن الإيمان ضد الأريوسية.',
  },
  {
    en: 'St. Cyril of Alexandria — the Pillar of Faith who defended the Theotokos at Ephesus.',
    ar: 'القديس كيرلس عمود الدين — حامي لقب والدة الإله في مجمع أفسس.',
  },
  {
    en: 'St. Mark the Apostle — who brought the Gospel to Egypt and founded our Coptic Church.',
    ar: 'القديس مرقس الرسول — كاروز الديار المصرية ومؤسس كنيستنا القبطية.',
  },
  {
    en: 'St. Mina the Wonder-Worker — whose miracles are countless and whose monastery draws millions.',
    ar: 'القديس مارمينا العجائبي — عجائبه لا تُحصى وديره يقصده الملايين.',
  },
  {
    en: 'St. George the Great Martyr — the brave soldier of Christ.',
    ar: 'القديس مارجرجس الشهيد العظيم — الجندي الشجاع للمسيح.',
  },
  {
    en: 'St. Demiana — the pure virgin martyr who chose Christ above all.',
    ar: 'القديسة دميانة — الشهيدة العفيفة التي اختارت المسيح فوق كل شيء.',
  },
  {
    en: 'St. Moses the Black — from a life of sin to a giant of repentance and sainthood.',
    ar: 'القديس موسى الأسود — من حياة الخطية إلى عملاق التوبة والقداسة.',
  },
  {
    en: 'St. Pachomius — founder of communal monastic life.',
    ar: 'القديس باخوميوس — مؤسس حياة الشركة الرهبانية.',
  },
  {
    en: 'St. Macarius the Great — the lamp of the desert of Scetis.',
    ar: 'القديس مقاريوس الكبير — مصباح برية شيهيت.',
  },
  {
    en: 'St. Shenouda the Archimandrite — the great leader of the White Monastery.',
    ar: 'القديس شنودة رئيس المتوحدين — القائد العظيم للدير الأبيض.',
  },
  {
    en: 'St. Pope Kyrillos VI — the man of prayer whose miracles continue to this day.',
    ar: 'البابا كيرلس السادس — رجل الصلاة الذي ما زالت عجائبه حتى اليوم.',
  },
  {
    en: 'St. Abanoub — the child martyr who confessed Christ boldly.',
    ar: 'القديس أبانوب — الشهيد الطفل الذي اعترف بالمسيح بشجاعة.',
  },
  {
    en: 'St. Barbara — the wise virgin martyr.',
    ar: 'القديسة بربارة — الشهيدة العذراء الحكيمة.',
  },
  {
    en: 'St. Philopateer Mercurius — the saint with the two swords.',
    ar: 'القديس فيلوباتير مرقوريوس — القديس ذو السيفين.',
  },
  {
    en: 'St. Marina the Martyr — who defeated the devil and confessed Christ.',
    ar: 'القديسة مارينا الشهيدة — التي غلبت الشيطان واعترفت بالمسيح.',
  },
  {
    en: 'St. John the Baptist — the Forerunner who prepared the way of the Lord.',
    ar: 'القديس يوحنا المعمدان — السابق الذي أعد طريق الرب.',
  },
  {
    en: 'St. Stephen — the first martyr and archdeacon, full of faith and the Holy Spirit.',
    ar: 'القديس استفانوس — أول الشهداء ورئيس الشمامسة، المملوء إيماناً وروحاً قدساً.',
  },
  {
    en: 'St. Paul the Apostle — from persecutor to the great preacher to the nations.',
    ar: 'القديس بولس الرسول — من مضطهد إلى الكارز العظيم للأمم.',
  },
  {
    en: 'St. Peter the Apostle — the rock on whom Christ built His Church.',
    ar: 'القديس بطرس الرسول — الصخرة التي بنى عليها المسيح كنيسته.',
  },
  {
    en: 'St. Thomas the Apostle — whose doubt turned into the greatest confession: "My Lord and my God!"',
    ar: 'القديس توما الرسول — الذي تحول شكه إلى أعظم اعتراف: "ربي وإلهي!"',
  },
  {
    en: 'St. Mary Magdalene — the first witness of the Resurrection.',
    ar: 'القديسة مريم المجدلية — أول شاهدة للقيامة.',
  },
  {
    en: 'St. Verena — who served the sick and taught cleanliness in Switzerland.',
    ar: 'القديسة فيرينا — التي خدمت المرضى وعلّمت النظافة في سويسرا.',
  },
  {
    en: 'St. Simon the Tanner — through whose faith the Mokattam mountain was moved.',
    ar: 'القديس سمعان الخراز — الذي بإيمانه انتقل جبل المقطم.',
  },
  {
    en: 'St. Bishoy — the beloved of Christ, who washed the feet of the Lord.',
    ar: 'القديس أنبا بيشوي — حبيب المسيح الذي غسل قدمي الرب.',
  },
  {
    en: 'St. Paula — the first hermit, who lived a hidden life of prayer in the desert.',
    ar: 'القديس أنبا بولا — أول السواح، عاش حياة الصلاة الخفية في البرية.',
  },
  {
    en: 'St. Didymus the Blind — the brilliant blind teacher of Alexandria.',
    ar: 'القديس ديديموس الضرير — المعلم السكندري البصير رغم العمى.',
  },
  {
    en: 'St. Clement of Alexandria — the great teacher of the Catechetical School.',
    ar: 'القديس إكليمنضس السكندري — المعلم العظيم للمدرسة اللاهوتية.',
  },
  {
    en: 'St. Severus of Antioch — the great defender of the Orthodox faith.',
    ar: 'القديس ساويرس الأنطاكي — المدافع العظيم عن الإيمان الأرثوذكسي.',
  },
];

function botDayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

function versePostFor(dayOfYear: number): string {
  const v = DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
  return (
    '📖 Daily Verse — آية اليوم\n\n' +
    '"' + v.en + '"\n— ' + v.refEn + '\n\n' +
    '"' + v.ar + '"\n— ' + v.refAr
  );
}

function saintPostFor(dayOfYear: number): string {
  const s = SAINTS_OF_DAY[dayOfYear % SAINTS_OF_DAY.length];
  return '☨ Saint of the Day — قديس اليوم\n\n' + s.en + '\n\n' + s.ar;
}

interface CalendarItem {
  en: string;
  ar: string;
}

// NOTE: the old rotating CALENDAR_NOTES were removed — the calendar bot is
// now fully date-driven: real feasts, the real daily fasting rule, and a
// countdown to the next feast, all from liturgicalEngine.ts.

function calendarPostFor(d: Date): string {
  // 1. A real feast today? Announce it with its verse.
  const feast = getTodayCommemoration(d);
  if (feast) {
    return (
      '☨ Feast Today — عيد اليوم\n\n' +
      feast.titleEn + ': ' + feast.nameEn + '\n' +
      '"' + feast.textEn + '"\n— ' + feast.refEn + '\n\n' +
      feast.titleAr + ': ' + feast.nameAr + '\n' +
      '"' + feast.textAr + '"\n— ' + feast.refAr + '\n\n' +
      '🕊️ ' + feast.fastingEn + ' — ' + feast.fastingAr
    );
  }

  // 2. No feast: today's real fasting rule.
  const fastEn = getFastingInfo(d, 'en');
  const fastAr = getFastingInfo(d, 'ar');
  if (fastEn.type !== 'fast_free') {
    return (
      '⛪ Today in the Church — اليوم في الكنيسة\n\n' +
      '🙏 ' + fastEn.label + '\n' +
      '🙏 ' + fastAr.label
    );
  }

  // 3. No fast either: count down to the next feast.
  const upcoming = getUpcomingFeastsFrom(d, 1);
  if (upcoming.length > 0) {
    const nx = upcoming[0];
    const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((sod(nx.date) - sod(d)) / 86400000);
    const whenEn = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
    const whenAr = days <= 0 ? 'اليوم' : days === 1 ? 'غداً' : days === 2 ? 'بعد يومين' : days <= 10 ? 'بعد ' + days + ' أيام' : 'بعد ' + days + ' يوماً';
    return (
      '📅 Coming Up — قريباً\n\n' +
      nx.nameEn + ' — ' + whenEn + '\n' +
      nx.nameAr + ' — ' + whenAr
    );
  }

  return (
    '⛪ Today in the Church — اليوم في الكنيسة\n\n' +
    'No fasting today — a good day to pray, read, and give thanks. 🙏\n' +
    'لا يوجد صوم اليوم — يوم جميل للصلاة والقراءة والشكر. 🙏'
  );
}

async function runCommunityBots(db: D1Database, now: Date): Promise<void> {
  // 1. Make sure the bot profiles exist (idempotent).
  for (const bot of COMMUNITY_BOTS) {
    try {
      await db
        .prepare(
          `INSERT INTO profiles (id, email, full_name, parish, bio, avatar_url, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'user', datetime('now'), datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             full_name = excluded.full_name,
             parish = excluded.parish,
             bio = excluded.bio,
             avatar_url = excluded.avatar_url,
             updated_at = datetime('now')`
        )
        .bind(bot.id, bot.id + '@orthodoxconnect.bot', bot.name, bot.parish, bot.bio, bot.avatar)
        .run();
    } catch (e) {
      console.warn('[bots] ensure profile failed for ' + bot.id, e);
    }
  }

  // 2. One post per bot per day (idempotent by dated post id).
  const dayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const doy = botDayOfYear(now);
  const jobs: Array<{ bot: CommunityBotDef; content: string }> = [
    { bot: COMMUNITY_BOTS[0], content: versePostFor(doy) },
    { bot: COMMUNITY_BOTS[1], content: saintPostFor(doy) },
    { bot: COMMUNITY_BOTS[2], content: calendarPostFor(now) },
  ];

  for (const job of jobs) {
    const postId = 'botpost-' + job.bot.id + '-' + dayStr;
    try {
      const existing = await db.prepare('SELECT id FROM posts WHERE id = ?').bind(postId).first();
      if (existing) continue;
      await db
        .prepare(
          `INSERT INTO posts (id, content, video_id, author_id, author_name, author_parish, author_avatar, image_url, group_id, likes_count, comments_count, reshares_count, created_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, NULL, 0, 0, 0, ?)`
        )
        .bind(
          postId,
          job.content,
          job.bot.id,
          job.bot.name,
          job.bot.parish,
          job.bot.avatar,
          now.toISOString()
        )
        .run();
    } catch (e) {
      console.warn('[bots] post failed for ' + job.bot.id, e);
    }
  }
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

      // V-Kid AI Storybook: POST /api/vkid/generate-story
      // Public endpoint used by the V-Kid app's AI Storybook & Quest Generator.
      // The Gemini key stays server-side in env.GEMINI_API_KEY (never shipped to clients).
      // The theme is whitelisted so the endpoint cannot be abused as an open proxy.
      if (url.pathname === '/api/vkid/generate-story' && request.method === 'POST') {
        const ALLOWED_THEMES = ['Outer Space', 'Jungle Safari', 'Magical Kingdom', 'Ocean Explorers', 'Dino Adventure'];
        let body: any = {};
        try { body = await request.json(); } catch (e) { /* fall through to validation */ }
        const childName = typeof body.childName === 'string' ? body.childName.trim().slice(0, 40) : '';
        const theme = typeof body.theme === 'string' ? body.theme.trim() : '';
        const ageGroup = typeof body.ageGroup === 'string' ? body.ageGroup.trim().slice(0, 20) : '';
        if (!childName || !ALLOWED_THEMES.includes(theme)) {
          return jsonResponse({ success: false, error: 'bad_request' }, 400);
        }
        const apiKey = (env as any).GEMINI_API_KEY;
        if (!apiKey) {
          return jsonResponse({ success: false, error: 'not_configured' }, 503);
        }
        const prompt =
          'Create a short, engaging, child-friendly 3-paragraph story for a child named ' + childName +
          ' (age group ' + (ageGroup || '2-13') + ') themed around "' + theme + '". ' +
          'The hero of the story is ' + childName + '. Keep the language simple and warm.\n' +
          'Return ONLY a JSON object with:\n' +
          '- title: story title\n' +
          '- story: the story text (3 short paragraphs)\n' +
          '- puzzle: an object with question (a fun mini math or word question embedded in the story), ' +
          'options (array of 3 short strings), answer (exactly one of the options).';
        try {
          const gres = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          });
          if (!gres.ok) return jsonResponse({ success: false, error: 'ai_failed' }, 502);
          const gdata: any = await gres.json();
          const aiText = (gdata && gdata.candidates && gdata.candidates[0] && gdata.candidates[0].content && gdata.candidates[0].content.parts && gdata.candidates[0].content.parts[0] && gdata.candidates[0].content.parts[0].text) || '{}';
          let parsed: any = {};
          try { parsed = JSON.parse(aiText); } catch (e) { /* fall through to validation */ }
          if (!parsed.title || !parsed.story) return jsonResponse({ success: false, error: 'ai_failed' }, 502);
          return jsonResponse({ success: true, title: String(parsed.title), story: String(parsed.story), puzzle: parsed.puzzle || null });
        } catch (e) {
          return jsonResponse({ success: false, error: 'ai_failed' }, 502);
        }
      }

      // Public VAPID key (safe to expose — clients need it to subscribe).
      if (url.pathname === '/api/push/vapid-public-key' && request.method === 'GET') {
        const { publicKey, privateKey } = await getVapidKeys(env);
        const pairValid = publicKey && privateKey ? await vapidPairValid(publicKey, privateKey) : false;
        return jsonResponse({ success: Boolean(publicKey), publicKey: publicKey || null, pairValid, v: 2 });
      }

      // Post translation: POST /api/translate { text, target: 'en'|'ar', post_id? }
      // -> { success, translatedText, detectedSource }. Authenticated (session
      // token) so it can't be used as an anonymous translation proxy. Long
      // posts are chunked per sentence pack; results are cached per isolate and
      // durably per post in post_translations (each post translated once).
      if ((url.pathname === '/api/translate' || url.pathname === '/api/translate/') && request.method === 'POST') {
        const auth = await getAuthIdentity(request, env);
        if (!auth.id) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }
        let body: any = {};
        try {
          body = await request.json();
        } catch (e) {
          /* fall through to validation */
        }
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        const target = body.target === 'ar' ? 'ar' : 'en';
        const postId = typeof body.post_id === 'string' && body.post_id ? body.post_id : (typeof body.postId === 'string' && body.postId ? body.postId : '');
        if (!text) {
          return jsonResponse({ success: false, error: 'Missing text' }, 400);
        }
        if (text.length > 8000) {
          return jsonResponse({ success: false, error: 'Text too long' }, 400);
        }
        const cacheKey = 'tr3:' + target + ':' + hashStr(text);
        const cached = translateCache.get(cacheKey);
        if (cached) {
          return jsonResponse({ success: true, translatedText: cached.text, detectedSource: cached.src, cached: true });
        }
        // Durable per-post cache: the first reader pays for the translation,
        // everyone after gets it instantly from D1.
        if (postId && env.DB) {
          try {
            const row = await env.DB.prepare(
              'SELECT content FROM post_translations WHERE post_id = ? AND lang = ?'
            ).bind(postId, target).first<{ content: string }>();
            if (row && row.content) {
              translateCache.set(cacheKey, { text: row.content, src: null });
              return jsonResponse({ success: true, translatedText: row.content, detectedSource: null, cached: true });
            }
          } catch (e) {
            /* fall through to live translation */
          }
        }
        try {
          const { text: translatedText, src: detectedSource } = await translateTextFull(text, target, env);
          if (translateCache.size > 500) {
            const firstKey = translateCache.keys().next().value;
            if (firstKey) translateCache.delete(firstKey);
          }
          translateCache.set(cacheKey, { text: translatedText, src: detectedSource });
          if (postId && env.DB) {
            try {
              await env.DB.prepare(
                'INSERT OR REPLACE INTO post_translations (post_id, lang, content) VALUES (?, ?, ?)'
              ).bind(postId, target, translatedText).run();
            } catch (e) {
              /* cache write is best-effort */
            }
          }
          return jsonResponse({ success: true, translatedText, detectedSource });
        } catch (e) {
          return jsonResponse({ success: false, error: 'Translation failed' }, 502);
        }
      }

      // Short invite codes: GET /api/invite-code (auth) -> { success, code }.
      // Each user gets one permanent 6-char code; the pretty link is
      // https://orthodoxconnect.live/join/ABC123 (redirects to /invite?ref=<userId>).
      if (url.pathname === '/api/invite-code' && request.method === 'GET') {
        const auth = await getAuthIdentity(request, env);
        if (!auth.id) {
          return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
        }
        if (!env.DB) {
          return jsonResponse({ success: false, error: 'Database unavailable' }, 500);
        }
        let row = await env.DB.prepare('SELECT code FROM referral_codes WHERE user_id = ?').bind(auth.id).first<{ code: string }>();
        if (!row) {
          const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let attempt = 0; attempt < 12 && !code; attempt++) {
            const candidate = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
            try {
              await env.DB.prepare('INSERT INTO referral_codes (code, user_id) VALUES (?, ?)').bind(candidate, auth.id).run();
              code = candidate;
            } catch (e) { /* collision: try again */ }
          }
          if (!code) {
            return jsonResponse({ success: false, error: 'Could not generate code' }, 500);
          }
          row = { code };
        }
        return jsonResponse({ success: true, code: row.code });
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
          const avatarUrl = body.avatar_url || body.avatarUrl || 'https://orthodoxconnect.live/launchericon-512x512.png';
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
          const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

          if (env.DB) {
            await env.DB.prepare('INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
              .bind(`s_${Date.now()}`, userId, token, expiresAt, now)
              .run();
          }

          // Automatic welcome message: every new member gets a warm welcome
          // in Messenger from the admin, plus a notification. Best-effort —
          // it must never break signup.
          if (env.DB) {
            try {
              const adminRow: any = await env.DB.prepare('SELECT id, full_name, avatar_url FROM profiles WHERE LOWER(email) = LOWER(?)').bind(SUPER_ADMIN_EMAIL).first();
              if (adminRow && adminRow.id && adminRow.id !== userId) {
                const welcomeId = `msg_welcome_${userId}`;
                const already = await env.DB.prepare('SELECT id FROM messages WHERE id = ?').bind(welcomeId).first();
                if (!already) {
                  const adminName = adminRow.full_name || 'OrthodoxConnect';
                  const welcomeText = `Welcome to OrthodoxConnect! We're so glad you're here. Take a look around the library and your parish rooms, and feel at home. God bless you!\n\nأهلاً بيك في أورثوذكس كونكت! مبسوطين إنك معانا.`;
                  await env.DB.prepare('INSERT INTO messages (id, sender_id, sender_name, receiver_id, content, image_url, video_url, audio_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?)').bind(welcomeId, adminRow.id, adminName, userId, welcomeText, now).run();
                  await env.DB.prepare('INSERT INTO notifications (id, recipient_id, actor_id, actor_name, actor_avatar, type, title, body, post_id, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(`notif_welcome_${userId}`, userId, adminRow.id, adminName, adminRow.avatar_url || '', 'message', `Message from ${adminName}`, welcomeText.slice(0, 120), null, 'messages', 0, now).run();
                }
              }
            } catch (welcomeErr) { /* never break signup */ }
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
                  VALUES (?, ?, ?, 'Super Admin', 'Holy Synod Headquarters', 'Global Administrator for OrthodoxConnect.', 'https://orthodoxconnect.live/launchericon-512x512.png', 'super_admin', 0, ?, ?)
                `).bind(superId, email, inputHash, now, now).run();
              }
              profileRow = {
                id: superId,
                email,
                password_hash: inputHash,
                full_name: 'Super Admin',
                parish: 'Holy Synod Headquarters',
                bio: 'Global Administrator for OrthodoxConnect.',
                avatar_url: 'https://orthodoxconnect.live/launchericon-512x512.png',
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
          const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

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
            avatar_url: profileRow.avatar_url || 'https://orthodoxconnect.live/launchericon-512x512.png',
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
        // Identity comes ONLY from a verified session token (query ?token= or
        // Authorization: Bearer). No valid token -> not authenticated, period.
        if ((authAction === 'session' || authAction === 'me') && request.method === 'GET') {
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, authenticated: false, user: null, profile: null });
          }

          let profileRow: D1ProfileRow | null = null;

          if (env.DB) {
            // auth.id is set ONLY when the session token verified above.
            profileRow = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(auth.id).first<D1ProfileRow>();
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
          const auth = await getAuthIdentity(request, env);
          const body: any = await request.json().catch(() => ({}));
          const token = body.token || auth.bearerToken;

          if (token && env.DB) {
            await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
          }
          return jsonResponse({ success: true, message: 'Signed out successfully.' });
        }

        // POST /api/auth/update-password
        if (authAction === 'update-password' && request.method === 'POST') {
          const auth = await getAuthIdentity(request, env);
          const body: any = await request.json().catch(() => ({}));
          const newPassword = body.password || body.newPassword || '';

          if (!newPassword || newPassword.length < 6) {
            return jsonResponse({ success: false, error: 'Password must be at least 6 characters.' }, 400);
          }

          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }

          const userId = String(body.user_id || body.userId || auth.id).trim() || auth.id;
          if (userId !== auth.id && !auth.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden: you can only change your own password.' }, 403);
          }

          const newHash = await hashPassword(newPassword);
          if (env.DB) {
            await env.DB.prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?')
              .bind(newHash, new Date().toISOString(), userId)
              .run();
            // A password change invalidates every other session for that account.
            if (auth.bearerToken) {
              await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').bind(userId, auth.bearerToken).run();
            } else {
              await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
            }
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
          const avatarUrl = body.avatar_url || body.avatarUrl || 'https://orthodoxconnect.live/launchericon-512x512.png';
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
          const auth = await getAuthIdentity(request, env);
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
          const _verifiedAuth = await getAuthIdentity(request, env);
          if (!_verifiedAuth.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          // The caller's own id is authoritative; query params can only narrow
          // to conversations the caller participates in.
          if (user1 && user2 && user1 !== _verifiedAuth.id && user2 !== _verifiedAuth.id && !_verifiedAuth.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
          }
          const myId = _verifiedAuth.id;

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
          const authMsg = await getAuthIdentity(request, env);
          if (!authMsg.id) {
            return jsonResponse({ success: false, error: 'Authentication required to send messages.' }, 401);
          }
          const senderId = authMsg.id;
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
          const authRd = await getAuthIdentity(request, env);
          if (!authRd.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          const readerId = authRd.id;
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
            stories = (results || []).map((r: any) => {
              const s: any = { ...r, image_url: r.image_url || r.media_url || '' };
              // Slim the JSON: serve inline base64 story media/avatars as separate
              // cacheable image URLs instead of megabytes of data-URIs (same
              // pattern as the posts list). The story viewer lazy-loads them.
              const sid = encodeURIComponent(String(r.id));
              if (/^data:image\//i.test(String(s.image_url || ''))) {
                s.image_url = 'https://orthodoxconnect.live/story-image/' + sid;
              }
              if (/^data:image\//i.test(String(s.media_url || ''))) {
                s.media_url = 'https://orthodoxconnect.live/story-image/' + sid;
              }
              if (/^data:image\//i.test(String(s.author_avatar || ''))) {
                s.author_avatar = 'https://orthodoxconnect.live/story-avatar/' + sid;
              }
              return s;
            });
          }
          return jsonResponse({ success: true, stories });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `story_${Date.now()}`);
          const authStory = await getAuthIdentity(request, env);
          if (!authStory.id) {
            return jsonResponse({ success: false, error: 'Authentication required to post stories.' }, 401);
          }
          const authorId = authStory.id;
          const authorName = body.author_name || body.authorName || 'Orthodox Parishioner';
          const authorAvatar = body.author_avatar || body.authorAvatar || 'https://orthodoxconnect.live/launchericon-512x512.png';
          const authorParish = body.author_parish || body.authorParish || 'Orthodox Church';
          const imageUrl = body.image_url || body.imageUrl || '';
          const mediaType = body.media_type || body.mediaType || 'image';
          const caption = body.caption || '';
          const createdAt = body.created_at || new Date().toISOString();
          const expiresAt = body.expires_at || new Date(Date.parse(createdAt) + 24 * 3600 * 1000).toISOString();

          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO stories (id, author_id, author_name, author_avatar, author_parish, image_url, media_url, media_type, caption, expires_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, authorId, authorName, authorAvatar, authorParish, imageUrl, imageUrl, mediaType, caption, expiresAt, createdAt).run();
          }

          return jsonResponse({
            success: true,
            story: { id, author_id: authorId, author_name: authorName, author_avatar: authorAvatar, author_parish: authorParish, image_url: imageUrl, media_type: mediaType, caption, expires_at: expiresAt, created_at: createdAt },
          }, 201);
        }
      }

      // 6a. Single Story (/api/stories/:id) — admin/author delete
      if (url.pathname.startsWith('/api/stories/')) {
        const storyId = decodeURIComponent(url.pathname.replace('/api/stories/', '').trim());
        if (storyId && !storyId.includes('/') && request.method === 'DELETE') {
          const auth = await getAuthIdentity(request, env);
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
            await env.DB.exec(`CREATE TABLE IF NOT EXISTS churches ( id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT DEFAULT '', cover TEXT DEFAULT '', description TEXT DEFAULT '', address TEXT DEFAULT '', city TEXT DEFAULT '', country TEXT DEFAULT '', priest_name TEXT DEFAULT '', phone TEXT DEFAULT '', website TEXT DEFAULT '', service_times TEXT DEFAULT '', owner_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
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
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          const ownerId = auth.id;
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
            const auth = await getAuthIdentity(request, env);
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
            const auth = await getAuthIdentity(request, env);
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
            await env.DB.exec(`CREATE TABLE IF NOT EXISTS marketplace_listings ( id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', price TEXT DEFAULT '', category TEXT DEFAULT 'other', images TEXT DEFAULT '[]', address TEXT DEFAULT '', city TEXT DEFAULT '', phone TEXT DEFAULT '', church_id TEXT DEFAULT '', church_name TEXT DEFAULT '', seller_id TEXT, seller_name TEXT DEFAULT '', seller_avatar TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
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
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
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
            seller_id: auth.id,
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
              await env.DB.exec(`CREATE TABLE IF NOT EXISTS marketplace_listings ( id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', price TEXT DEFAULT '', category TEXT DEFAULT 'other', images TEXT DEFAULT '[]', address TEXT DEFAULT '', city TEXT DEFAULT '', phone TEXT DEFAULT '', church_id TEXT DEFAULT '', church_name TEXT DEFAULT '', seller_id TEXT, seller_name TEXT DEFAULT '', seller_avatar TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
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
            const auth = await getAuthIdentity(request, env);
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
            const auth = await getAuthIdentity(request, env);
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
          const authEvt = await getAuthIdentity(request, env);
          if (!authEvt.id) {
            return jsonResponse({ success: false, error: 'Authentication required to create events.' }, 401);
          }
          const hostId = authEvt.id;
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
          const auth = await getAuthIdentity(request, env);
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

      // 8a. Bunny Stream Live endpoints (true YouTube-style live streaming)
      // Requires BUNNY_STREAM_API_KEY env var (same as the video library API key).
      // Gracefully returns a clear error when the key is missing (e.g. preview not approved yet).
      const getBunnyLiveKey = (): string | null => {
        return env.BUNNY_STREAM_API_KEY || env.BUNNY_API_KEY || DEFAULT_BUNNY_API_KEY || null;
      };
      const getBunnyLibraryId = (): string => {
        return env.BUNNY_LIBRARY_ID || DEFAULT_BUNNY_LIBRARY_ID;
      };

      // POST /api/live-streams/bunny/create — create a Bunny Stream Live stream + D1 record
      if (url.pathname === '/api/live-streams/bunny/create' || url.pathname === '/api/live-streams/bunny/create/') {
        if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
        const apiKey = getBunnyLiveKey();
        if (!apiKey) {
          return jsonResponse({ success: false, error: 'BUNNY_NOT_CONFIGURED', message: 'Live streaming is being set up. Please try again later.' }, 503);
        }
        const body: any = await request.json().catch(() => ({}));
        const title = body.title || 'Parish Live Service';
        const description = body.description || '';
        const recordVod = body.recordVod !== undefined ? Boolean(body.recordVod) : true;
        const hostParish = body.host_parish || body.parish || 'Orthodox Church';
        const priestName = body.priest_name || body.priestName || 'Priest / Host';
        const libraryId = getBunnyLibraryId();

        let bunnyData: any = null;
        try {
          const bunnyRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/live`, {
            method: 'POST',
            headers: {
              'AccessKey': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, description, recordVod }),
          });
          if (!bunnyRes.ok) {
            const errText = await bunnyRes.text().catch(() => '');
            return jsonResponse({ success: false, error: 'BUNNY_CREATE_FAILED', message: `Bunny Stream Live rejected the request (${bunnyRes.status}). Live streaming may not be enabled on this library yet.`, detail: errText.slice(0, 500) }, 502);
          }
          bunnyData = await bunnyRes.json();
        } catch (fetchErr: any) {
          return jsonResponse({ success: false, error: 'BUNNY_UNREACHABLE', message: 'Could not reach Bunny Stream. Please try again.', detail: String(fetchErr?.message || fetchErr).slice(0, 300) }, 502);
        }

        const bunnyStreamId = bunnyData.guid || bunnyData.id || null;
        const streamKey = bunnyData.streamKey || null;
        const playbackUrlHls = bunnyData.playbackUrlHls || bunnyData.playbackUrl || null;
        const ingest = (bunnyData.ingestEndpoints && bunnyData.ingestEndpoints.rtmp) || {};
        const rtmpUrl = ingest.primaryIngestUrl || 'rtmp://global.rtmp.mediadelivery.net/live';

        const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `blive_${Date.now()}`);
        const createdAt = new Date().toISOString();
        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO live_streams (id, title, host_parish, priest_name, media_url, is_live, viewers_count, created_at,
              bunny_stream_id, bunny_stream_key, playback_url_hls, status, description, viewer_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, title, hostParish, priestName, 'bunny-live', 1, 1, createdAt,
            bunnyStreamId, streamKey, playbackUrlHls, 'scheduled', description, 0).run();
        }

        return jsonResponse({
          success: true,
          stream: {
            id, title, host_parish: hostParish, priest_name: priestName,
            bunny_stream_id: bunnyStreamId, playback_url_hls: playbackUrlHls,
            rtmp_url: rtmpUrl, stream_key: streamKey, status: 'scheduled', created_at: createdAt,
          },
        }, 201);
      }

      // GET /api/live-streams/live — all currently-live Bunny streams
      if (url.pathname === '/api/live-streams/live' || url.pathname === '/api/live-streams/live/') {
        if (request.method !== 'GET') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
        let rows: any[] = [];
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare(
              "SELECT * FROM live_streams WHERE status = 'live' ORDER BY started_at DESC"
            ).all();
            rows = results || [];
          } catch (e: any) {
            // Fallback if status column doesn't exist yet on this D1 instance
            console.warn('[live-streams/live] fallback:', e?.message || e);
          }
        }
        return jsonResponse({ success: true, live_streams: rows });
      }

      // POST /api/live-streams/bunny/:id/start — mark a Bunny stream as live
      if (url.pathname.startsWith('/api/live-streams/bunny/') && url.pathname.endsWith('/start') && request.method === 'POST') {
        const parts = url.pathname.split('/').filter(Boolean);
        const streamId = decodeURIComponent(parts[3] || '');
        if (!streamId) return jsonResponse({ success: false, error: 'Missing stream id' }, 400);
        if (!env.DB) return jsonResponse({ success: false, error: 'Database unavailable' }, 500);
        const now = new Date().toISOString();
        try {
          await env.DB.prepare(
            "UPDATE live_streams SET status = 'live', started_at = ?, is_live = 1 WHERE id = ?"
          ).bind(now, streamId).run();
        } catch (e: any) {
          return jsonResponse({ success: false, error: 'DB_UPDATE_FAILED', detail: String(e?.message || e).slice(0, 300) }, 500);
        }
        const row = await env.DB.prepare('SELECT * FROM live_streams WHERE id = ?').bind(streamId).first();
        return jsonResponse({ success: true, stream: row });
      }

      // POST /api/live-streams/bunny/:id/end — end a Bunny stream
      if (url.pathname.startsWith('/api/live-streams/bunny/') && url.pathname.endsWith('/end') && request.method === 'POST') {
        const parts = url.pathname.split('/').filter(Boolean);
        const streamId = decodeURIComponent(parts[3] || '');
        if (!streamId) return jsonResponse({ success: false, error: 'Missing stream id' }, 400);
        if (!env.DB) return jsonResponse({ success: false, error: 'Database unavailable' }, 500);
        const now = new Date().toISOString();
        try {
          await env.DB.prepare(
            "UPDATE live_streams SET status = 'ended', ended_at = ?, is_live = 0 WHERE id = ?"
          ).bind(now, streamId).run();
        } catch (e: any) {
          return jsonResponse({ success: false, error: 'DB_UPDATE_FAILED', detail: String(e?.message || e).slice(0, 300) }, 500);
        }
        const row = await env.DB.prepare('SELECT * FROM live_streams WHERE id = ?').bind(streamId).first();
        return jsonResponse({ success: true, stream: row });
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
              const auth = await getAuthIdentity(request, env);
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
                      const rawLikerAv = String(r.user_avatar || '');
                      arr.push({
                        userId: r.user_id,
                        userName: r.user_name || 'Orthodox Member',
                        // Never ship megabytes of base64 avatars in the feed;
                        // the app falls back to the launcher icon when empty.
                        userAvatar: /^data:image\//i.test(rawLikerAv) ? '' : r.user_avatar,
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
                // Slim the JSON: serve inline base64 photos/avatars as separate
                // cacheable image URLs instead of megabytes of data-URIs.
                if (/^data:image\//i.test(String(p.image_url || ''))) {
                  p.image_url = 'https://orthodoxconnect.live/post-image/' + encodeURIComponent(key);
                }
                if (/^data:image\//i.test(String(p.author_avatar || ''))) {
                  p.author_avatar = 'https://orthodoxconnect.live/post-avatar/' + encodeURIComponent(key);
                }
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

          const authPost = await getAuthIdentity(request, env);
          if (!authPost.id) {
            return jsonResponse({ success: false, error: 'Authentication required to post.' }, 401);
          }
          const authorId = authPost.id;
          const authorName = body.author_name ?? body.authorName ?? 'Orthodox Parishioner';
          const authorParish = body.author_parish ?? body.authorParish ?? 'Orthodox Church';
          const authorAvatar =
            body.author_avatar ??
            body.authorAvatar ??
            'https://orthodoxconnect.live/launchericon-512x512.png';
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
                authorAvatar ?? 'https://orthodoxconnect.live/launchericon-512x512.png',
                imageUrl ?? null,
                groupId ?? null,
                likesCount ?? 0,
                commentsCount ?? 0,
                resharesCount ?? 0,
                createdAt ?? new Date().toISOString()
              )
              .run();
          }

          // Translate the new post into the other language in the background
          // and store it, so readers in either language see it instantly.
          try {
            ctx.waitUntil(pretranslatePost(id, content, env));
          } catch (e) {
            /* background translation is best-effort */
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
        const auth = await getAuthIdentity(request, env);

        const userId = (auth.id || '').trim();
        if (!userId) {
          return jsonResponse({ success: false, error: 'Authentication required to bless posts' }, 401);
        }

        const actorName = body.author_name || body.userName || body.user_name || auth.email || 'Orthodox Parishioner';
        const actorAvatar = body.author_avatar || body.userAvatar || body.user_avatar || 'https://orthodoxconnect.live/launchericon-512x512.png';

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
        const auth = await getAuthIdentity(request, env);

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
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required to comment.' }, 401);
          }
          const userId = auth.id;
          const authorName = body.author_name || body.authorName || auth.email || 'Orthodox Parishioner';
          const authorAvatar = body.author_avatar || body.authorAvatar || 'https://orthodoxconnect.live/launchericon-512x512.png';
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
          if (/^data:image\//i.test(String((post as any).image_url || ''))) {
            (post as any).image_url = 'https://orthodoxconnect.live/post-image/' + encodeURIComponent(String((post as any).id));
          }
          if (/^data:image\//i.test(String((post as any).author_avatar || ''))) {
            (post as any).author_avatar = 'https://orthodoxconnect.live/post-avatar/' + encodeURIComponent(String((post as any).id));
          }
          return jsonResponse({ success: true, post });
        }

        if (request.method === 'DELETE') {
          const auth = await getAuthIdentity(request, env);
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
        if (env.DB) {
          // Self-healing: make sure the book engagement tables exist. (The
          // giant ensureD1Tables batch can throw before later migrations run.)
          try {
            await env.DB.exec(`CREATE TABLE IF NOT EXISTS book_likes ( book_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (book_id, user_id))`);
            await env.DB.exec(`CREATE TABLE IF NOT EXISTS book_comments ( id TEXT PRIMARY KEY, book_id TEXT NOT NULL, user_id TEXT NOT NULL, author_name TEXT, author_avatar TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL)`);
          } catch (e) { /* tables already exist */ }
        }
        if (request.method === 'GET') {
          const category = url.searchParams.get('category');
          const q = (url.searchParams.get('q') || '').trim();

          let books: any[] = [];
          if (env.DB) {
            const params: any[] = [];
            let where = 'WHERE 1=1';
            if (category && category !== 'all') {
              where += ' AND b.category = ?';
              params.push(category);
            }
            if (q) {
              where += ' AND (b.title_ar LIKE ? OR b.title_en LIKE ? OR b.author_ar LIKE ? OR b.author_en LIKE ?)';
              const pattern = `%${q}%`;
              params.push(pattern, pattern, pattern, pattern);
            }
            const order = ' ORDER BY datetime(b.created_at) DESC, b.created_at DESC';

            // Prefer the counts query; fall back to the plain query if the
            // engagement tables do not exist yet (never break the library).
            try {
              const query = `SELECT b.*,
                (SELECT COUNT(*) FROM book_likes WHERE book_id = b.id) AS likes_count,
                (SELECT COUNT(*) FROM book_comments WHERE book_id = b.id) AS comments_count
                FROM books b ${where}${order}`;
              const { results } = await env.DB.prepare(query).bind(...params).all<any>();
              books = results || [];
            } catch (countsErr) {
              const plainWhere = where.replace(/b\./g, '');
              const plainOrder = order.replace(/b\./g, '');
              const query = `SELECT * FROM books ${plainWhere}${plainOrder}`;
              const { results } = await env.DB.prepare(query).bind(...params).all<any>();
              books = (results || []).map((b: any) => ({ ...b, likes_count: 0, comments_count: 0 }));
            }

            // Mark which books the current user liked (optional auth — endpoint stays public).
            try {
              const authBooks = await getAuthIdentity(request, env);
              if (authBooks.id && books.length) {
                const likedRows = await env.DB.prepare('SELECT book_id FROM book_likes WHERE user_id = ?').bind(authBooks.id).all<{ book_id: string }>();
                const likedSet = new Set((likedRows.results || []).map((r) => r.book_id));
                books = books.map((b) => ({ ...b, liked_by_me: likedSet.has(b.id) }));
              }
            } catch (e) { /* public read still works */ }
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

      // 16a. Book like toggle (/api/books/:id/like)
      if (url.pathname.match(/^\/api\/books\/[^/]+\/like\/?$/) && env.DB) {
        const bookId = decodeURIComponent(url.pathname.replace('/api/books/', '').replace(/\/like\/?$/, ''));
        if (request.method === 'POST') {
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          const book = await env.DB.prepare('SELECT id FROM books WHERE id = ?').bind(bookId).first();
          if (!book) return jsonResponse({ success: false, error: 'Book not found' }, 404);
          const existing = await env.DB.prepare('SELECT 1 FROM book_likes WHERE book_id = ? AND user_id = ?').bind(bookId, auth.id).first();
          let liked: boolean;
          if (existing) {
            await env.DB.prepare('DELETE FROM book_likes WHERE book_id = ? AND user_id = ?').bind(bookId, auth.id).run();
            liked = false;
          } else {
            await env.DB.prepare('INSERT INTO book_likes (book_id, user_id, created_at) VALUES (?, ?, ?)').bind(bookId, auth.id, new Date().toISOString()).run();
            liked = true;
          }
          const cnt = await env.DB.prepare('SELECT COUNT(*) as c FROM book_likes WHERE book_id = ?').bind(bookId).first<{ c: number }>();
          return jsonResponse({ success: true, liked, likes_count: cnt ? Number(cnt.c) : 0 });
        }
      }

      // 16b. Book comments list & create (/api/books/:id/comments)
      if (url.pathname.match(/^\/api\/books\/[^/]+\/comments\/?$/) && env.DB) {
        const bookId = decodeURIComponent(url.pathname.replace('/api/books/', '').replace(/\/comments\/?$/, ''));

        if (request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM book_comments WHERE book_id = ? ORDER BY created_at ASC').bind(bookId).all();
          const comments = results || [];
          return jsonResponse({ success: true, book_id: bookId, comments, count: comments.length });
        }

        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required to comment.' }, 401);
          }
          const content = (body.content || body.text || '').trim();
          if (!content) {
            return jsonResponse({ success: false, error: 'Comment content cannot be empty' }, 400);
          }
          const book = await env.DB.prepare('SELECT id FROM books WHERE id = ?').bind(bookId).first();
          if (!book) return jsonResponse({ success: false, error: 'Book not found' }, 404);
          const id = body.id || `bcomm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const authorName = body.author_name || auth.email || 'Orthodox Parishioner';
          const authorAvatar = body.author_avatar || 'https://orthodoxconnect.live/launchericon-512x512.png';
          const createdAt = new Date().toISOString();
          await env.DB.prepare(
            'INSERT INTO book_comments (id, book_id, user_id, author_name, author_avatar, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, bookId, auth.id, authorName, authorAvatar, content, createdAt).run();
          const cnt = await env.DB.prepare('SELECT COUNT(*) as c FROM book_comments WHERE book_id = ?').bind(bookId).first<{ c: number }>();
          return jsonResponse({
            success: true,
            comment: { id, book_id: bookId, user_id: auth.id, author_name: authorName, author_avatar: authorAvatar, content, created_at: createdAt },
            comments_count: cnt ? Number(cnt.c) : 1,
          }, 201);
        }
      }

      // 16c. Delete a book comment (/api/books/comments/:commentId) — author or admin.
      if (url.pathname.match(/^\/api\/books\/comments\/[^/]+\/?$/) && env.DB) {
        const commentId = decodeURIComponent(url.pathname.replace('/api/books/comments/', '').replace(/\/?$/, ''));
        if (request.method === 'DELETE') {
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          const comm = await env.DB.prepare('SELECT * FROM book_comments WHERE id = ?').bind(commentId).first<any>();
          if (!comm) return jsonResponse({ success: false, error: 'Comment not found' }, 404);
          if (comm.user_id !== auth.id && !auth.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
          }
          await env.DB.prepare('DELETE FROM book_comments WHERE id = ?').bind(commentId).run();
          const cnt = await env.DB.prepare('SELECT COUNT(*) as c FROM book_comments WHERE book_id = ?').bind(comm.book_id).first<{ c: number }>();
          return jsonResponse({ success: true, comments_count: cnt ? Number(cnt.c) : 0 });
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
          const auth = await getAuthIdentity(request, env);
          if (!auth.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden: Admin access required.' }, 403);
          }
          if (env.DB) {
            await env.DB.prepare('DELETE FROM books WHERE id = ?').bind(bookId).run();
            await env.DB.prepare('DELETE FROM book_likes WHERE book_id = ?').bind(bookId).run();
            await env.DB.prepare('DELETE FROM book_comments WHERE book_id = ?').bind(bookId).run();
          }
          return jsonResponse({ success: true, id: bookId, message: 'Book deleted successfully.' });
        }
      }

      // 16d. Synaxarium engagement — likes & comments per Coptic day.
      // Key format: "MM-DD" (zero-padded Coptic month/day), e.g. "01-04".
      // One key per day, shared across languages and years, so the whole
      // community likes and comments on the same day entry.
      if (url.pathname.startsWith('/api/synaxarium/') && env.DB) {
        // Self-healing: make sure the synaxarium engagement tables exist.
        try {
          await env.DB.exec(`CREATE TABLE IF NOT EXISTS synax_likes ( synax_key TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (synax_key, user_id) )`);
          await env.DB.exec(`CREATE TABLE IF NOT EXISTS synax_comments ( id TEXT PRIMARY KEY, synax_key TEXT NOT NULL, user_id TEXT NOT NULL, author_name TEXT, author_avatar TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL )`);
        } catch (e) { /* tables already exist */ }

        const validSynaxKey = (k: string): boolean => {
          const m = /^(\d{2})-(\d{2})$/.exec(k || '');
          if (!m) return false;
          const mo = Number(m[1]), da = Number(m[2]);
          if (mo < 1 || mo > 13) return false;
          if (mo === 13) return da >= 1 && da <= 6;
          return da >= 1 && da <= 30;
        };

        // GET /api/synaxarium/engagement?key=MM-DD — counts + my like (public).
        if (url.pathname === '/api/synaxarium/engagement' || url.pathname === '/api/synaxarium/engagement/') {
          const key = (url.searchParams.get('key') || '').trim();
          if (!validSynaxKey(key)) return jsonResponse({ success: false, error: 'Invalid synaxarium key.' }, 400);
          let likesCount = 0, commentsCount = 0, likedByMe = false;
          try {
            const l = await env.DB.prepare('SELECT COUNT(*) as c FROM synax_likes WHERE synax_key = ?').bind(key).first<{ c: number }>();
            const c = await env.DB.prepare('SELECT COUNT(*) as c FROM synax_comments WHERE synax_key = ?').bind(key).first<{ c: number }>();
            likesCount = l ? Number(l.c) : 0;
            commentsCount = c ? Number(c.c) : 0;
          } catch (e) { /* tables missing — report zeros */ }
          try {
            const authEng = await getAuthIdentity(request, env);
            if (authEng.id) {
              const row = await env.DB.prepare('SELECT 1 FROM synax_likes WHERE synax_key = ? AND user_id = ?').bind(key, authEng.id).first();
              likedByMe = Boolean(row);
            }
          } catch (e) { /* public read still works */ }
          return jsonResponse({ success: true, synax_key: key, likes_count: likesCount, comments_count: commentsCount, liked_by_me: likedByMe });
        }

        // POST /api/synaxarium/like — toggle my like (auth required).
        if ((url.pathname === '/api/synaxarium/like' || url.pathname === '/api/synaxarium/like/') && request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const key = String(body.key || '').trim();
          if (!validSynaxKey(key)) return jsonResponse({ success: false, error: 'Invalid synaxarium key.' }, 400);
          const authLike = await getAuthIdentity(request, env);
          if (!authLike.id) return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          const existing = await env.DB.prepare('SELECT 1 FROM synax_likes WHERE synax_key = ? AND user_id = ?').bind(key, authLike.id).first();
          let liked: boolean;
          if (existing) {
            await env.DB.prepare('DELETE FROM synax_likes WHERE synax_key = ? AND user_id = ?').bind(key, authLike.id).run();
            liked = false;
          } else {
            await env.DB.prepare('INSERT INTO synax_likes (synax_key, user_id, created_at) VALUES (?, ?, ?)').bind(key, authLike.id, new Date().toISOString()).run();
            liked = true;
          }
          const cnt = await env.DB.prepare('SELECT COUNT(*) as c FROM synax_likes WHERE synax_key = ?').bind(key).first<{ c: number }>();
          return jsonResponse({ success: true, liked, likes_count: cnt ? Number(cnt.c) : 0 });
        }

        // GET/POST /api/synaxarium/comments — list & create (create needs auth).
        if (url.pathname === '/api/synaxarium/comments' || url.pathname === '/api/synaxarium/comments/') {
          if (request.method === 'GET') {
            const key = (url.searchParams.get('key') || '').trim();
            if (!validSynaxKey(key)) return jsonResponse({ success: false, error: 'Invalid synaxarium key.' }, 400);
            const { results } = await env.DB.prepare('SELECT * FROM synax_comments WHERE synax_key = ? ORDER BY created_at ASC').bind(key).all();
            const comments = results || [];
            return jsonResponse({ success: true, synax_key: key, comments, count: comments.length });
          }
          if (request.method === 'POST') {
            const body: any = await request.json().catch(() => ({}));
            const key = String(body.key || '').trim();
            if (!validSynaxKey(key)) return jsonResponse({ success: false, error: 'Invalid synaxarium key.' }, 400);
            const authComm = await getAuthIdentity(request, env);
            if (!authComm.id) return jsonResponse({ success: false, error: 'Authentication required to comment.' }, 401);
            const content = (body.content || body.text || '').trim();
            if (!content) return jsonResponse({ success: false, error: 'Comment content cannot be empty' }, 400);
            const id = body.id || `scomm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const authorName = body.author_name || (authComm as any).email || 'Orthodox Parishioner';
            const authorAvatar = body.author_avatar || 'https://orthodoxconnect.live/launchericon-512x512.png';
            const createdAt = new Date().toISOString();
            await env.DB.prepare('INSERT INTO synax_comments (id, synax_key, user_id, author_name, author_avatar, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, key, authComm.id, authorName, authorAvatar, content, createdAt).run();
            const cnt = await env.DB.prepare('SELECT COUNT(*) as c FROM synax_comments WHERE synax_key = ?').bind(key).first<{ c: number }>();
            return jsonResponse({ success: true, comment: { id, synax_key: key, user_id: authComm.id, author_name: authorName, author_avatar: authorAvatar, content, created_at: createdAt }, comments_count: cnt ? Number(cnt.c) : 1 }, 201);
          }
        }

        // DELETE /api/synaxarium/comments/:commentId — author or admin.
        if (url.pathname.match(/^\/api\/synaxarium\/comments\/[^/]+\/?$/) && request.method === 'DELETE') {
          const commentId = decodeURIComponent(url.pathname.replace('/api/synaxarium/comments/', '').replace(/\/?$/, ''));
          const authDel = await getAuthIdentity(request, env);
          if (!authDel.id) return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          const comm = await env.DB.prepare('SELECT * FROM synax_comments WHERE id = ?').bind(commentId).first<any>();
          if (!comm) return jsonResponse({ success: false, error: 'Comment not found' }, 404);
          if (comm.user_id !== authDel.id && !authDel.isAdmin) return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
          await env.DB.prepare('DELETE FROM synax_comments WHERE id = ?').bind(commentId).run();
          const cnt = await env.DB.prepare('SELECT COUNT(*) as c FROM synax_comments WHERE synax_key = ?').bind(comm.synax_key).first<{ c: number }>();
          return jsonResponse({ success: true, comments_count: cnt ? Number(cnt.c) : 0 });
        }
      }

      // 16d. Follows (/api/follows) — server-backed follow persistence.
      // GET returns my follow list. POST replaces my whole follow list
      // (full-list sync from the client; last writer wins).
      if ((url.pathname === '/api/follows' || url.pathname === '/api/follows/') && env.DB) {
        const authF = await getAuthIdentity(request, env);
        if (!authF.id) {
          return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
        }
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT following_id, following_name, created_at FROM follows WHERE follower_id = ? ORDER BY created_at DESC'
          ).bind(authF.id).all<{ following_id: string; following_name: string; created_at: string }>();
          return jsonResponse({ success: true, follows: results || [] });
        }
        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const list = Array.isArray(body.follows) ? body.follows : [];
          await env.DB.prepare('DELETE FROM follows WHERE follower_id = ?').bind(authF.id).run();
          const now = new Date().toISOString();
          let count = 0;
          for (const f of list.slice(0, 5000)) {
            const fid = String(f.following_id || f.id || '').trim().slice(0, 160);
            if (!fid || fid === authF.id) continue;
            const fname = String(f.following_name || f.name || '').slice(0, 120);
            try {
              await env.DB.prepare(
                'INSERT OR REPLACE INTO follows (follower_id, following_id, following_name, created_at) VALUES (?, ?, ?, ?)'
              ).bind(authF.id, fid, fname, now).run();
              count++;
            } catch (e) { /* skip bad rows */ }
          }
          return jsonResponse({ success: true, count });
        }
        return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
      }
      // Public follower / following counts for a profile.
      if (url.pathname === '/api/follows/counts' && env.DB) {
        const targetId = (url.searchParams.get('user_id') || '').trim().slice(0, 160);
        if (!targetId) return jsonResponse({ success: false, error: 'user_id required' }, 400);
        const fr = await env.DB.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').bind(targetId).first<{ c: number }>();
        const fg = await env.DB.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?').bind(targetId).first<{ c: number }>();
        return jsonResponse({ success: true, followers: fr ? Number(fr.c) : 0, following: fg ? Number(fg.c) : 0 });
      }

      // 17. Notifications (/api/notifications)
      if (url.pathname === '/api/notifications/mark-read' || url.pathname === '/api/notifications/mark-read/') {
        if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
        const body: any = await request.json().catch(() => ({}));
        const authMr = await getAuthIdentity(request, env);
        if (!authMr.id) {
          return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
        }
        const id = body.id;
        const recipientId = authMr.id;
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
          const auth = await getAuthIdentity(request, env);
          if (!auth.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          const requested = url.searchParams.get('recipient_id') || url.searchParams.get('user_id');
          if (requested && requested !== auth.id && !auth.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
          }
          const recipientId = requested || auth.id;
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
          const authNt = await getAuthIdentity(request, env);
          if (!authNt.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          const id = body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif-${Date.now()}`);
          const recipientId = body.recipient_id ?? body.userId ?? body.user_id ?? null;
          const actorId = authNt.id;
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
                  icon: actorAvatar || 'https://orthodoxconnect.live/launchericon-512x512.png',
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
          const authNd = await getAuthIdentity(request, env);
          if (!authNd.id) {
            return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          }
          const row: any = await env.DB.prepare('SELECT recipient_id FROM notifications WHERE id = ?').bind(notifId).first();
          if (!row) {
            return jsonResponse({ success: false, error: 'Not found.' }, 404);
          }
          const rec = row.recipient_id;
          if (rec !== authNd.id && rec !== 'all' && rec !== null && !authNd.isAdmin) {
            return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
          }
          await env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(notifId).run();
          return jsonResponse({ success: true, id: notifId, message: 'Notification deleted' });
        }
      }

      // 17b. Call signaling relay + Web Push (cross-device calls, works even when app is closed)
      if (url.pathname === '/api/call-signals' || url.pathname === '/api/call-signals/') {
        // Standalone self-heal: tiny ALTERs that must not live inside the giant ensureD1Tables exec
        if (env.DB) {
          try { await env.DB.prepare('ALTER TABLE call_signals ADD COLUMN sdp TEXT').run(); } catch (e) {}
          try { await env.DB.prepare('ALTER TABLE call_signals ADD COLUMN candidate TEXT').run(); } catch (e) {}
          try { await env.DB.prepare('ALTER TABLE call_signals ADD COLUMN meta TEXT').run(); } catch (e) {}
          try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS push_debug_log (id TEXT PRIMARY KEY, created_at TEXT, info TEXT)').run(); } catch (e) {}
          try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)').run(); } catch (e) {}
        }
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
          const sdp = typeof sig.sdp === 'string' ? sig.sdp : null;
          const candidate = typeof sig.candidate === 'string' ? sig.candidate : null;
          const meta = typeof sig.meta === 'string' ? sig.meta : (sig.meta ? JSON.stringify(sig.meta) : null);
          try { await env.DB.prepare('DELETE FROM call_signals WHERE created_at < ?').bind(nowMs - 120000).run(); } catch (e) {}
          await env.DB.prepare(
            'INSERT INTO call_signals (id, call_id, sig_type, caller_id, caller_name, caller_avatar, target_user_id, call_type, sdp, candidate, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, callId, sigType, callerId, callerName, callerAvatar, targetUserId, callType, sdp, candidate, meta, nowMs).run();

          let pushDiag: any = null;
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
              // Match subscriptions on both raw and auth--stripped user ID formats
              const strippedTarget = targetUserId.replace(/^auth-/, '');
              const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth, user_id FROM push_subscriptions WHERE user_id = ? OR user_id = ?').bind(targetUserId, strippedTarget).all();
              const subs = results || [];
              const pushPayload = {
                type: 'call',
                title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
                body: `${callerName} is calling you on OrthodoxConnect.`,
                icon: callerAvatar || 'https://orthodoxconnect.live/launchericon-512x512.png',
                data: { url: '/?call=' + callId, callId, callerName, callType },
              };
              let sent = 0;
              const seen = new Set<string>();
              const sendResults: any[] = [];
              for (const s of subs as any[]) {
                if (s && s.endpoint && s.p256dh && s.auth && !seen.has(s.endpoint)) {
                  seen.add(s.endpoint);
                  try {
                    (globalThis as any).__lastPushStatus = null;
                    const ok = await sendWebPush(env, { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, pushPayload);
                    if (ok) sent++;
                    sendResults.push({ ok, status: (globalThis as any).__lastPushStatus, endpointHost: String(s.endpoint).split('/')[2] || '' });
                  } catch (pe) { console.warn('[call-signals] push send failed:', (pe as any)?.message || pe); }
                }
              }
              pushDiag = { attempted: true, subscriptions: subs.length, sent, targetUserId, strippedTarget, sendResults };
              try {
                const logId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`);
                await env.DB.prepare('INSERT INTO push_debug_log (id, created_at, info) VALUES (?, ?, ?)').bind(
                  logId, new Date().toISOString(),
                  JSON.stringify({ ...pushDiag, subUserIds: (subs as any[]).map((x: any) => x.user_id), callId })
                ).run();
                // Keep only the last 20 entries
                try { await env.DB.prepare('DELETE FROM push_debug_log WHERE id NOT IN (SELECT id FROM push_debug_log ORDER BY created_at DESC LIMIT 20)').run(); } catch (e) {}
              } catch (e) {}
            } catch (e) { console.warn('[call-signals] push failed:', (e as any)?.message || e); }
          }
          return jsonResponse({ success: true, id, _push: pushDiag }, 201);
        }
        if (request.method === 'GET' && env.DB) {
          const userId = url.searchParams.get('user_id') || '';
          const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
          let signals: any[] = [];
          if (userId) {
            const { results } = await env.DB.prepare(
              'SELECT id, call_id, sig_type, caller_id, caller_name, caller_avatar, target_user_id, call_type, sdp, candidate, meta, created_at FROM call_signals WHERE target_user_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 50'
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

      // 17b. Group calls — announce / discover / end live group video calls
      if (url.pathname === '/api/group-calls' && env.DB) {
        if (request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const roomId = String(body.room_id || body.roomId || '');
          if (!roomId) return jsonResponse({ success: false, error: 'room_id required' }, 400);
          const id = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `gc-${Date.now()}`);
          const now = new Date().toISOString();
          await env.DB.prepare(
            'INSERT INTO group_calls (id, room_id, room_name, host_id, host_name, started_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            id,
            roomId,
            String(body.room_name || body.roomName || 'Group Call'),
            String(body.host_id || body.hostId || ''),
            String(body.host_name || body.hostName || 'Host'),
            now,
          ).run();
          return jsonResponse({ success: true, id, room_id: roomId, started_at: now });
        }
        if (request.method === 'GET') {
          const roomId = String(url.searchParams.get('room_id') || url.searchParams.get('roomId') || '');
          // Active = heartbeat within the last 2 minutes (stale ones are pruned on read)
          const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
          try { await env.DB.prepare('DELETE FROM group_calls WHERE started_at < ?').bind(cutoff).run(); } catch (e) {}
          let rows: any[] = [];
          if (roomId) {
            const { results } = await env.DB.prepare(
              'SELECT id, room_id, room_name, host_id, host_name, started_at FROM group_calls WHERE room_id = ? ORDER BY started_at DESC LIMIT 5'
            ).bind(roomId).all();
            rows = results || [];
          }
          return jsonResponse({ success: true, calls: rows });
        }
      }
      if (url.pathname.startsWith('/api/group-calls/') && env.DB) {
        const rest = decodeURIComponent(url.pathname.replace('/api/group-calls/', '').trim());
        if (request.method === 'DELETE' && rest && !rest.includes('/')) {
          await env.DB.prepare('DELETE FROM group_calls WHERE id = ?').bind(rest).run();
          return jsonResponse({ success: true, id: rest });
        }
        if (request.method === 'POST' && rest.endsWith('/heartbeat')) {
          const callId = rest.replace('/heartbeat', '');
          await env.DB.prepare('UPDATE group_calls SET started_at = ? WHERE id = ?').bind(new Date().toISOString(), callId).run();
          return jsonResponse({ success: true, id: callId });
        }
      }

      // 17b1. Store VAPID keys in D1 (admin; survives redeploys)
      if (url.pathname === '/api/admin/vapid-keys' && request.method === 'POST' && env.DB) {
        try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)').run(); } catch (e) {}
        const body: any = await request.json().catch(() => ({}));
        const pub = String(body.public_key || '');
        const priv = String(body.private_key || '');
        if (!pub || !priv) return jsonResponse({ success: false, error: 'public_key and private_key required' }, 400);
        const now = new Date().toISOString();
        await env.DB.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').bind('vapid_public', pub, now).run();
        await env.DB.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').bind('vapid_private', priv, now).run();
        return jsonResponse({ success: true });
      }

      // 17b2. Push debug log (temporary diagnostic)
      if (url.pathname === '/api/debug/push-log' && env.DB) {
        try {
          const { results } = await env.DB.prepare('SELECT created_at, info FROM push_debug_log ORDER BY created_at DESC LIMIT 10').all();
          return jsonResponse({ success: true, entries: results || [] });
        } catch (e) {
          return jsonResponse({ success: true, entries: [] });
        }
      }

      // 17c. Push subscriptions (Web Push for calls when app is closed)
      // Test push endpoint: send a test notification to all of a user's devices
      if (url.pathname === '/api/push-subscriptions/test' && request.method === 'POST' && env.DB) {
        const body: any = await request.json().catch(() => ({}));
        const authPs = await getAuthIdentity(request, env);
        if (!authPs.id) return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
        const userId = String(body.user_id || body.userId || authPs.id);
        if (userId !== authPs.id && !authPs.isAdmin) return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
        const { results } = await env.DB.prepare(
          'SELECT endpoint, p256dh, auth, created_at FROM push_subscriptions WHERE user_id = ?'
        ).bind(userId).all();
        let sent = 0;
        const details: Array<{ endpoint_tail: string; endpoint_host: string; created_at: string; accepted: boolean }> = [];
        for (const s of (results || []) as any[]) {
          (globalThis as any).__lastPushStatus = null;
          (globalThis as any).__lastPushBody = '';
          // Unique id per send so the device can ping back receipt ("it arrived").
          const pushId = 'tp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
          try { await env.DB.prepare('INSERT INTO push_receipts (push_id, user_id) VALUES (?, ?)').bind(pushId, userId).run(); } catch (e) {}
          const ok = await sendWebPush(env, { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, {
            title: 'OrthodoxConnect ✓',
            body: 'Push notifications are working on this device!',
            icon: 'https://orthodoxconnect.live/launchericon-512x512.png',
            badge: 'https://orthodoxconnect.live/launchericon-512x512.png',
            data: { url: '/', pushId },
          });
          if (ok) sent++;
          details.push({ endpoint_tail: String(s.endpoint || '').slice(-16), endpoint_host: String(s.endpoint || '').split('/')[2] || '', created_at: String(s.created_at || ''), accepted: ok, fcm_status: (globalThis as any).__lastPushStatus ?? null, fcm_body: (globalThis as any).__lastPushBody || '' });
        }
        const lastPushId = details.length ? (await env.DB.prepare('SELECT push_id FROM push_receipts WHERE user_id = ? ORDER BY sent_at DESC LIMIT 1').bind(userId).first() as any)?.push_id || null : null;
        return jsonResponse({ success: true, subscriptions: (results || []).length, sent, details, push_id: lastPushId });
      }
      // Device pingback: the service worker calls this when a push actually arrives
      // on the phone. No auth — the push_id is unguessable and write-only receipt.
      if (url.pathname === '/api/push-received' && env.DB) {
        if (request.method === 'POST') {
          const b: any = await request.json().catch(() => ({}));
          const pid = String(b.push_id || b.pushId || '');
          if (pid) {
            try { await env.DB.prepare("UPDATE push_receipts SET received_at = datetime('now') WHERE push_id = ?").bind(pid).run(); } catch (e) {}
          }
          return jsonResponse({ success: true });
        }
        if (request.method === 'GET') {
          const pid = String(url.searchParams.get('push_id') || '');
          const row: any = pid ? await env.DB.prepare('SELECT push_id, sent_at, received_at FROM push_receipts WHERE push_id = ?').bind(pid).first().catch(() => null) : null;
          return jsonResponse({ success: true, receipt: row || null });
        }
      }
      if (url.pathname === '/api/push-subscriptions' || url.pathname === '/api/push-subscriptions/') {
        if (request.method === 'POST' && env.DB) {
          const body: any = await request.json().catch(() => ({}));
          const authPu = await getAuthIdentity(request, env);
          if (!authPu.id) return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          const userId = String(body.user_id || body.userId || authPu.id);
          if (userId !== authPu.id && !authPu.isAdmin) return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
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
          const authPd = await getAuthIdentity(request, env);
          if (!authPd.id) return jsonResponse({ success: false, error: 'Authentication required.' }, 401);
          const userId = String(body.user_id || body.userId || authPd.id);
          if (userId !== authPd.id && !authPd.isAdmin) return jsonResponse({ success: false, error: 'Forbidden.' }, 403);
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
          const auth = await getAuthIdentity(request, env);
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

      // Public post image: /post-image/:id — decodes the inline base64 data-URI
      // photos stored on posts so link-preview scrapers (Facebook/WhatsApp)
      // can fetch a real og:image. No login required.
      if ((request.method === 'GET' || request.method === 'HEAD') && env.DB &&
          url.pathname.startsWith('/post-image/')) {
        const imgId = decodeURIComponent(url.pathname.replace('/post-image/', '').split('/')[0].trim());
        if (imgId) {
          try {
            const row = await env.DB.prepare('SELECT image_url FROM posts WHERE id = ?').bind(imgId).first<any>();
            const m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(row?.image_url || ''));
            if (m) {
              const bin = atob(m[2].replace(/\s+/g, ''));
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const imgHeaders: Record<string, string> = {
                'Content-Type': m[1],
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Length': String(bytes.length),
              };
              return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers: imgHeaders });
            }
          } catch (e) {}
        }
        return new Response('Not found', { status: 404 });
      }

      // Public post avatar: /post-avatar/:id — decodes the inline base64 data-URI
      // avatars stored on posts so list responses can stay tiny. No login required.
      if ((request.method === 'GET' || request.method === 'HEAD') && env.DB &&
          url.pathname.startsWith('/post-avatar/')) {
        const avId = decodeURIComponent(url.pathname.replace('/post-avatar/', '').split('/')[0].trim());
        if (avId) {
          try {
            const row = await env.DB.prepare('SELECT author_avatar FROM posts WHERE id = ?').bind(avId).first<any>();
            const m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(row?.author_avatar || ''));
            if (m) {
              const bin = atob(m[2].replace(/\s+/g, ''));
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const avHeaders: Record<string, string> = {
                'Content-Type': m[1],
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Length': String(bytes.length),
              };
              return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers: avHeaders });
            }
          } catch (e) {}
        }
        return new Response('Not found', { status: 404 });
      }

      // Public story image: /story-image/:id — decodes the inline base64 data-URI
      // media stored on stories so the stories list response stays tiny.
      // No login required.
      if ((request.method === 'GET' || request.method === 'HEAD') && env.DB &&
          url.pathname.startsWith('/story-image/')) {
        const imgId = decodeURIComponent(url.pathname.replace('/story-image/', '').split('/')[0].trim());
        if (imgId) {
          try {
            const row = await env.DB.prepare('SELECT image_url, media_url FROM stories WHERE id = ?').bind(imgId).first<any>();
            const m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(row?.image_url || row?.media_url || ''));
            if (m) {
              const bin = atob(m[2].replace(/\s+/g, ''));
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const imgHeaders: Record<string, string> = {
                'Content-Type': m[1],
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Length': String(bytes.length),
              };
              return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers: imgHeaders });
            }
          } catch (e) {}
        }
        return new Response('Not found', { status: 404 });
      }

      // Public story avatar: /story-avatar/:id — decodes the inline base64 data-URI
      // avatars stored on stories so the stories list response stays tiny.
      // No login required.
      if ((request.method === 'GET' || request.method === 'HEAD') && env.DB &&
          url.pathname.startsWith('/story-avatar/')) {
        const avId = decodeURIComponent(url.pathname.replace('/story-avatar/', '').split('/')[0].trim());
        if (avId) {
          try {
            const row = await env.DB.prepare('SELECT author_avatar FROM stories WHERE id = ?').bind(avId).first<any>();
            const m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(row?.author_avatar || ''));
            if (m) {
              const bin = atob(m[2].replace(/\s+/g, ''));
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const avHeaders: Record<string, string> = {
                'Content-Type': m[1],
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Length': String(bytes.length),
              };
              return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers: avHeaders });
            }
          } catch (e) {}
        }
        return new Response('Not found', { status: 404 });
      }

      // Short invite links: /join/ABC123 -> 302 to /invite?ref=<userId>.
      // (Old /invite?ref=<uuid> links keep working via App.tsx.)
      if (request.method === 'GET' && url.pathname.startsWith('/join/') && env.DB) {
        const code = decodeURIComponent(url.pathname.replace('/join/', '').split('/')[0] || '').toUpperCase().trim();
        if (code) {
          const row = await env.DB.prepare('SELECT user_id FROM referral_codes WHERE code = ?').bind(code).first<{ user_id: string }>();
          if (row && row.user_id) {
            return Response.redirect(`${url.origin}/invite?ref=${encodeURIComponent(row.user_id)}`, 302);
          }
        }
        return Response.redirect(`${url.origin}/invite`, 302);
      }

      // Public share pages: /post/:id, /live/:id, /book/:id, /synax/:MM-DD
      // (OG tags + preview + app CTA).
      // HEAD is served too: several link-preview scrapers probe headers first.
      // NOTE: /synax/ is matched only for MM-DD keys so it can never swallow
      // the static /synaxarium/*.json data files.
      if ((request.method === 'GET' || request.method === 'HEAD') && env.DB &&
          (url.pathname.startsWith('/post/') || url.pathname.startsWith('/live/') || url.pathname.startsWith('/book/') ||
           /^\/synax\/\d{1,2}-\d{1,2}\/?$/.test(url.pathname))) {
        let kind: string;
        let prefix: string;
        if (url.pathname.startsWith('/live/')) { kind = 'live'; prefix = '/live/'; }
        else if (url.pathname.startsWith('/book/')) { kind = 'book'; prefix = '/book/'; }
        else if (url.pathname.startsWith('/synax/')) { kind = 'synax'; prefix = '/synax/'; }
        else { kind = 'post'; prefix = '/post/'; }
        const shareId = decodeURIComponent(url.pathname.replace(prefix, '').split('/')[0].trim());
        if (shareId) {
          return await renderSharePage(env.DB, kind, shareId);
        }
      }

      return jsonResponse({ success: false, error: 'Endpoint Not Found' }, 404);
    } catch (err: any) {
      console.error('[Cloudflare Worker Error]:', err);
      return jsonResponse({ success: false, error: err?.message || 'Internal Server Error' }, 500);
    }
  },

  // Daily community bots: verse, saint, and calendar posts.
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    try {
      if (!env.DB) return;
      await ensureD1TablesOnce(env.DB);
      await runCommunityBots(env.DB, new Date(event.scheduledTime || Date.now()));
    } catch (err) {
      console.error('[bots] scheduled run failed:', err);
    }
  },
};
