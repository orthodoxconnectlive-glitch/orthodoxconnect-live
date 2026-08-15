-- Cloudflare D1 SQLite Schema for OrthodoxConnect
-- Database: orthodoxconnect
-- Database ID: cc2a30b0-43f6-4485-a2d7-8ca4e8e8a4fe

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

-- Indices for rapid querying & feed filtering
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_video_id ON posts(video_id);
CREATE INDEX IF NOT EXISTS idx_posts_group_id ON posts(group_id);
