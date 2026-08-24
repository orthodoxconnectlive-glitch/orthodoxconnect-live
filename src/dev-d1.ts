/**
 * Local Cloudflare D1 Database Emulator for Vite Dev Server
 * Backed by Node.js 22 native SQLite (node:sqlite)
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import type { D1Database, D1PreparedStatement } from './worker';

let instance: D1Database | null = null;

export function getDevD1Database(): D1Database {
  if (instance) return instance;

  const dbPath = path.resolve(process.cwd(), '.d1.sqlite');
  const db = new DatabaseSync(dbPath);

  // Enable foreign keys
  try {
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (e) {}

  // Initialize schema if needed
  try {
    const schemaPath = path.resolve(process.cwd(), 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schemaSql);
    }
  } catch (err) {
    console.warn('[D1 Dev Emulator] Schema init note:', err);
  }

  // Seed default demo content if tables are empty
  try {
    const postCountStmt = db.prepare('SELECT COUNT(*) as cnt FROM posts');
    const row = postCountStmt.get() as any;
    if (row && Number(row.cnt) === 0) {
      db.exec(`
        INSERT INTO profiles (id, email, password_hash, full_name, parish, bio, avatar_url, role, is_banned, created_at, updated_at)
        VALUES 
          ('user-fr-anthony', 'fr.anthony@orthodox.org', 'seeded', 'Fr. Anthony Shenouda', 'St. Mark Coptic Orthodox Cathedral', 'Priest and spiritual father.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', 'clergy', 0, datetime('now'), datetime('now')),
          ('user-deacon-mark', 'deacon.mark@orthodox.org', 'seeded', 'Deacon Mark Mikhail', 'St. George Coptic Orthodox Church', 'Youth leader and servant.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', 'user', 0, datetime('now'), datetime('now')),
          ('super-admin-root', 'orthodoxconnect.live@gmail.com', 'seeded', 'Super Admin', 'Holy Synod Headquarters', 'Global Administrator for OrthodoxConnect.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200', 'super_admin', 0, datetime('now'), datetime('now'));

        INSERT INTO posts (id, content, video_id, author_id, author_name, author_parish, author_avatar, image_url, likes_count, comments_count, reshares_count, created_at)
        VALUES 
          ('post-seed-1', 'Blessed Feast of the Transfiguration of our Lord and Savior Jesus Christ! "Lord, it is good for us to be here; if You wish, let us make here three tabernacles: one for You, one for Moses, and one for Elijah." (Matthew 17:4)', NULL, 'user-fr-anthony', 'Fr. Anthony Shenouda', 'St. Mark Coptic Orthodox Cathedral', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800', 14, 1, 5, datetime('now', '-2 hours')),
          ('post-seed-2', 'Glory to God! The youth choir has uploaded the live recording of the midnight praises (Tasbeha) from Friday night.', 'sample-bunny-guid-01', 'user-deacon-mark', 'Deacon Mark Mikhail', 'St. George Coptic Orthodox Church', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', NULL, 22, 0, 4, datetime('now', '-5 hours'));

        INSERT INTO post_comments (id, post_id, user_id, author_name, author_avatar, content, created_at)
        VALUES 
          ('comm-seed-1', 'post-seed-1', 'user-deacon-mark', 'Deacon Mark Mikhail', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', 'Axios! Blessed feast to all the congregation.', datetime('now', '-1 hour'));

        INSERT INTO stories (id, author_id, author_name, author_avatar, author_parish, image_url, caption, created_at)
        VALUES 
          ('story-seed-1', 'user-fr-anthony', 'Fr. Anthony Shenouda', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', 'St. Mark Cathedral', 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=600', 'Daily Liturgy reflection', datetime('now', '-3 hours'));

        INSERT INTO live_streams (id, title, host_parish, priest_name, media_url, is_live, viewers_count, created_at)
        VALUES 
          ('stream-seed-1', 'Sunday Divine Liturgy Live', 'St. Mark Coptic Orthodox Cathedral', 'Fr. Anthony Shenouda', 'https://www.youtube.com/embed/live_stream?channel=sample', 1, 142, datetime('now'));

        INSERT INTO notifications (id, recipient_id, actor_id, actor_name, actor_avatar, type, title, body, post_id, link, is_read, created_at)
        VALUES 
          ('notif-seed-1', 'all', 'user-fr-anthony', 'Fr. Anthony Shenouda', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', 'system', 'Welcome to OrthodoxConnect', 'Connect with your parish, watch spiritual reflections, and join the community.', NULL, 'feed', 0, datetime('now'));
      `);
    }
  } catch (err) {
    console.warn('[D1 Dev Emulator] Seed note:', err);
  }

  instance = {
    prepare(query: string): D1PreparedStatement {
      let boundValues: any[] = [];
      return {
        bind(...values: any[]) {
          boundValues = values.map((v) => (v === undefined ? null : v));
          return this;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          try {
            const stmt = db.prepare(query);
            const row = stmt.get(...boundValues) as any;
            if (!row) return null;
            if (colName && typeof row === 'object') {
              return row[colName] ?? null;
            }
            return row as T;
          } catch (e: any) {
            console.error('[D1 first error]:', e?.message, 'Query:', query, 'Params:', boundValues);
            return null;
          }
        },
        async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
          try {
            const stmt = db.prepare(query);
            const rows = stmt.all(...boundValues) as T[];
            return { results: rows || [], success: true, meta: {} };
          } catch (e: any) {
            console.error('[D1 all error]:', e?.message, 'Query:', query, 'Params:', boundValues);
            return { results: [], success: false, meta: { error: e?.message } };
          }
        },
        async run<T = unknown>(): Promise<{ success: boolean; results?: T[]; meta: any }> {
          try {
            const stmt = db.prepare(query);
            const result = stmt.run(...boundValues);
            return { success: true, meta: result };
          } catch (e: any) {
            console.error('[D1 run error]:', e?.message, 'Query:', query, 'Params:', boundValues);
            return { success: false, meta: { error: e?.message } };
          }
        },
      };
    },
    async exec(query: string): Promise<{ count: number; duration: number }> {
      try {
        db.exec(query);
        return { count: 1, duration: 0 };
      } catch (e: any) {
        console.error('[D1 exec error]:', e?.message);
        throw e;
      }
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[] }[]> {
      const results: { results: T[] }[] = [];
      for (const st of statements) {
        const res = await st.all<T>();
        results.push({ results: res.results });
      }
      return results;
    },
    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
  };

  return instance;
}
