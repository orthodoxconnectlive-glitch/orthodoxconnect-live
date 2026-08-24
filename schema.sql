-- Cloudflare D1 SQLite Schema for OrthodoxConnect
-- Database: orthodoxconnect
-- Compatible with Cloudflare Workers + D1 SQLite engine

-- 1. Users / Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  full_name TEXT NOT NULL DEFAULT 'Orthodox Parishioner',
  parish TEXT NOT NULL DEFAULT 'Orthodox Church',
  bio TEXT DEFAULT 'Orthodox Christian seeking fellowship and spiritual growth.',
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
  role TEXT NOT NULL DEFAULT 'user', -- 'user', 'admin', 'owner', 'super_admin', 'clergy'
  is_banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. User Sessions Table (Edge Auth / Bearer tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- 3. Posts Table
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

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_video_id ON posts(video_id);
CREATE INDEX IF NOT EXISTS idx_posts_group_id ON posts(group_id);

-- 4. Post Likes Table
CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- 5. Post Comments Table
CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT,
  author_name TEXT DEFAULT 'Orthodox Parishioner',
  author_avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at ASC);

-- 6. Messages Table (Messenger / Direct Chats)
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

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(sender_id, receiver_id, created_at ASC);

-- 7. Stories Table (Stories Bar)
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

CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);

-- 8. Parish Events Table
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
  rsvps TEXT DEFAULT '[]', -- JSON encoded string of RSVPs
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date ASC);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- 9. Live Broadcasts Table
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

CREATE INDEX IF NOT EXISTS idx_live_streams_is_live ON live_streams(is_live, created_at DESC);

-- 10. Moderation & Content Reports Table
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

CREATE INDEX IF NOT EXISTS idx_reports_status ON content_reports(status, created_at DESC);

-- 11. Notifications Table
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

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
