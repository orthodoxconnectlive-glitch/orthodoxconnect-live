import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, UserConfig, Plugin } from 'vite';

function localApiDevPlugin(): Plugin {
  // In-memory store for local Vite dev testing
  const devPosts: any[] = [];

  return {
    name: 'local-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/posts')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost:3000');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (url.pathname === '/api/posts' || url.pathname === '/api/posts/') {
          if (req.method === 'GET') {
            const authorId = url.searchParams.get('author_id') || url.searchParams.get('authorId');
            const groupId = url.searchParams.get('group_id') || url.searchParams.get('groupId');
            const videoOnly = url.searchParams.get('video_only') === 'true' || url.searchParams.get('videos') === 'true';

            let filtered = [...devPosts];
            if (authorId) {
              filtered = filtered.filter((p) => p.author_id === authorId || p.author_name?.toLowerCase().includes(authorId.toLowerCase()));
            }
            if (groupId) {
              filtered = filtered.filter((p) => p.group_id === groupId);
            }
            if (videoOnly) {
              filtered = filtered.filter((p) => Boolean(p.video_id));
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, posts: filtered }));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const newRow = {
                  id: parsed.id || `post-${Date.now()}`,
                  content: parsed.content || parsed.text || '',
                  video_id: parsed.video_id || parsed.videoId || null,
                  author_id: parsed.author_id || parsed.authorId || null,
                  author_name: parsed.author_name || parsed.authorName || 'Orthodox Parishioner',
                  author_parish: parsed.author_parish || parsed.authorParish || 'Orthodox Church',
                  author_avatar: parsed.author_avatar || parsed.authorAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
                  image_url: parsed.image_url || parsed.image || null,
                  group_id: parsed.group_id || parsed.groupId || null,
                  likes_count: parsed.likes_count || 0,
                  comments_count: parsed.comments_count || 0,
                  reshares_count: parsed.reshares_count || 0,
                  created_at: parsed.created_at || new Date().toISOString(),
                };

                const existingIdx = devPosts.findIndex((p) => p.id === newRow.id);
                if (existingIdx >= 0) {
                  devPosts[existingIdx] = newRow;
                } else {
                  devPosts.unshift(newRow);
                }

                res.statusCode = 201;
                res.end(JSON.stringify({ success: true, post: newRow }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: e?.message }));
              }
            });
            return;
          }
        }

        if (url.pathname.startsWith('/api/posts/')) {
          const postId = url.pathname.replace('/api/posts/', '').trim();
          if (req.method === 'DELETE') {
            const idx = devPosts.findIndex((p) => p.id === postId);
            if (idx >= 0) devPosts.splice(idx, 1);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: postId }));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig((): UserConfig => {
  return {
    base: '/',
    build: {
      outDir: 'dist',
    },
    plugins: [react(), tailwindcss(), localApiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
