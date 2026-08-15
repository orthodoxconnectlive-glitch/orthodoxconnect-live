import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, UserConfig, Plugin } from 'vite';

function localApiDevPlugin(): Plugin {
  // In-memory store for local Vite dev testing
  let devPosts: any[] = [
    {
      id: 'post-seed-1',
      content: 'Blessed Feast of the Transfiguration of our Lord and Savior Jesus Christ! "Lord, it is good for us to be here; if You wish, let us make here three tabernacles: one for You, one for Moses, and one for Elijah." (Matthew 17:4)',
      video_id: null,
      author_id: 'user-fr-anthony',
      author_name: 'Fr. Anthony Shenouda',
      author_parish: 'St. Mark Coptic Orthodox Cathedral',
      author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      image_url: 'https://images.unsplash.com/photo-1548625361-1959779df5ff?auto=format&fit=crop&q=80&w=800',
      group_id: null,
      likes_count: 14,
      comments_count: 3,
      reshares_count: 5,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'post-seed-2',
      content: 'Glory to God! The youth choir has uploaded the live recording of the midnight praises (Tasbeha) from Friday night.',
      video_id: 'sample-bunny-guid-01',
      author_id: 'user-deacon-mark',
      author_name: 'Deacon Mark Mikhail',
      author_parish: 'St. George Coptic Orthodox Church',
      author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      image_url: null,
      group_id: null,
      likes_count: 22,
      comments_count: 7,
      reshares_count: 4,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    }
  ];

  return {
    name: 'local-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost:3000');

        // Handle Bunny API Proxy in dev
        if (url.pathname === '/api/bunny/create-video' || url.pathname === '/api/bunny/create-video/') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const videoTitle = parsed.title || `Orthodox_Video_${Date.now()}`;
                const libraryId = process.env.VITE_BUNNY_LIBRARY_ID || '713265';
                const apiKey = process.env.VITE_BUNNY_API_KEY || '615dab8d-4588-4669-934446d0dc3f-a0a1-4dfd';

                const bunnyRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
                  method: 'POST',
                  headers: {
                    AccessKey: apiKey,
                    'Content-Type': 'application/json',
                    accept: 'application/json',
                  },
                  body: JSON.stringify({ title: videoTitle }),
                });

                if (bunnyRes.ok) {
                  const data = await bunnyRes.json();
                  const guid = data.guid;
                  res.statusCode = 201;
                  res.end(
                    JSON.stringify({
                      success: true,
                      guid,
                      libraryId,
                      embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=false&loop=false&muted=false&preload=true`,
                      directUploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
                    })
                  );
                } else {
                  // If external fetch fails, fallback mock guid for local offline dev
                  const mockGuid = `local-bunny-${Date.now()}`;
                  res.statusCode = 201;
                  res.end(
                    JSON.stringify({
                      success: true,
                      guid: mockGuid,
                      libraryId,
                      embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${mockGuid}?autoplay=false&loop=false&muted=false&preload=true`,
                      directUploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${mockGuid}`,
                    })
                  );
                }
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: err?.message }));
              }
            });
            return;
          }
        }

        if (!req.url?.startsWith('/api/posts')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Email, X-User-Role, X-User-Id, x-user-email, x-user-role, x-user-id, x-target-email, x-target-role');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const userEmail = String(req.headers['x-user-email'] || '').trim().toLowerCase();
        const userRole = String(req.headers['x-user-role'] || '').trim().toLowerCase();
        const userId = String(req.headers['x-user-id'] || '').trim();
        const isSuperAdmin = userEmail === 'orthodoxconnect.live@gmail.com' || userRole === 'super_admin';
        const isAdmin = isSuperAdmin || userRole === 'admin' || userRole === 'owner';

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
              filtered = filtered.filter((p) => p.video_id && String(p.video_id).trim() !== '');
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
            const post = devPosts.find((p) => p.id === postId);
            const isAuthor = Boolean(post && userId && post.author_id === userId);
            const canDelete = isAdmin || isAuthor;

            if (post && !canDelete) {
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: 'Forbidden: You do not have permission to delete this post.' }));
              return;
            }

            const idx = devPosts.findIndex((p) => p.id === postId);
            if (idx >= 0) devPosts.splice(idx, 1);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: postId }));
            return;
          }
        }

        if (url.pathname.startsWith('/api/users/')) {
          const targetUserId = url.pathname.replace('/api/users/', '').trim();
          if (req.method === 'DELETE') {
            if (!isAdmin) {
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: 'Forbidden: Admin access required to delete users.' }));
              return;
            }

            const targetEmail = String(url.searchParams.get('target_email') || req.headers['x-target-email'] || '').trim().toLowerCase();
            const targetRole = String(url.searchParams.get('target_role') || req.headers['x-target-role'] || 'user').trim().toLowerCase();

            if (targetEmail === 'orthodoxconnect.live@gmail.com' || targetRole === 'super_admin') {
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: 'Forbidden: The Super Admin account cannot be deleted.' }));
              return;
            }

            const isTargetAdmin = targetRole === 'admin' || targetRole === 'owner';
            if (isTargetAdmin && userEmail !== 'orthodoxconnect.live@gmail.com') {
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: 'Forbidden: Only the Super Admin (orthodoxconnect.live@gmail.com) has permission to delete Admin accounts.' }));
              return;
            }

            // Remove target posts
            devPosts = devPosts.filter((p) => p.author_id !== targetUserId);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: targetUserId, message: 'User deleted successfully.' }));
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
