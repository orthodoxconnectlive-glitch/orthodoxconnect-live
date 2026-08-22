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

  const devPostLikes: Array<{ post_id: string; user_id: string; created_at: string }> = [];
  const devPostComments: Array<{
    id: string;
    post_id: string;
    user_id: string | null;
    author_name: string;
    author_avatar: string;
    content: string;
    created_at: string;
  }> = [
    {
      id: 'comm-seed-1',
      post_id: 'post-seed-1',
      user_id: 'user-deacon-mark',
      author_name: 'Deacon Mark Mikhail',
      author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      content: 'Axios! Blessed feast to all the congregation.',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
  let devNotifications: Array<{
    id: string;
    recipient_id: string | null;
    actor_id: string | null;
    actor_name: string;
    actor_avatar: string | null;
    type: string;
    title: string;
    body: string;
    post_id: string | null;
    link: string | null;
    is_read: number;
    created_at: string;
  }> = [
    {
      id: 'notif-seed-1',
      recipient_id: 'all',
      actor_id: 'user-admin',
      actor_name: 'Fr. Athanasius',
      actor_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      type: 'system',
      title: 'Welcome to OrthodoxConnect',
      body: 'Connect with your parish, watch spiritual reflections, and join the community.',
      post_id: null,
      link: 'feed',
      is_read: 0,
      created_at: new Date().toISOString(),
    },
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
                      guid,
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

        if (!req.url?.startsWith('/api/')) {
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

        // 1. Likes endpoint: POST /api/posts/:id/like
        const likeMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/like\/?$/);
        if (likeMatch && req.method === 'POST') {
          const postId = decodeURIComponent(likeMatch[1]);
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const effectiveUserId = parsed.user_id || parsed.userId || userId || 'anon-user';
              const actorName = parsed.user_name || parsed.userName || parsed.author_name || (userEmail ? userEmail.split('@')[0] : 'Orthodox Parishioner');
              const actorAvatar = parsed.user_avatar || parsed.userAvatar || parsed.author_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

              const existingIndex = devPostLikes.findIndex((l) => l.post_id === postId && l.user_id === effectiveUserId);
              const post = devPosts.find((p) => p.id === postId);

              let liked = false;
              if (existingIndex >= 0) {
                devPostLikes.splice(existingIndex, 1);
                if (post) {
                  post.likes_count = Math.max(0, (post.likes_count || 1) - 1);
                }
                liked = false;
              } else {
                devPostLikes.push({ post_id: postId, user_id: effectiveUserId, created_at: new Date().toISOString() });
                if (post) {
                  post.likes_count = (post.likes_count || 0) + 1;
                }
                liked = true;

                if (post && post.author_id && post.author_id !== effectiveUserId) {
                  devNotifications.unshift({
                    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    recipient_id: post.author_id,
                    actor_id: effectiveUserId,
                    actor_name: actorName,
                    actor_avatar: actorAvatar,
                    type: 'like',
                    title: `${actorName} liked your reflection`,
                    body: `Liked: "${post.content ? (post.content.length > 50 ? post.content.slice(0, 50) + '...' : post.content) : 'Post'}"`,
                    post_id: postId,
                    link: 'feed',
                    is_read: 0,
                    created_at: new Date().toISOString(),
                  });
                }
              }

              const allPostLikes = devPostLikes.filter((l) => l.post_id === postId);
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  liked,
                  is_liked: liked,
                  likes_count: post?.likes_count ?? (liked ? 1 : 0),
                  liked_by_user_ids: allPostLikes.map((l) => l.user_id),
                })
              );
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: e?.message }));
            }
          });
          return;
        }

        // 2. Comments endpoint: GET/POST /api/posts/:id/comments
        const commentsMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/comments\/?$/);
        if (commentsMatch) {
          const postId = decodeURIComponent(commentsMatch[1]);
          if (req.method === 'GET') {
            const comments = devPostComments.filter((c) => c.post_id === postId);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, comments }));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const content = (parsed.content || parsed.text || '').trim();
                if (!content) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ success: false, error: 'Comment content cannot be empty' }));
                  return;
                }

                const effectiveUserId = parsed.user_id || parsed.userId || userId || null;
                const authorName = parsed.author_name || parsed.authorName || (userEmail ? userEmail.split('@')[0] : 'Orthodox Parishioner');
                const authorAvatar = parsed.author_avatar || parsed.authorAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';
                const newComment = {
                  id: parsed.id || `comm-${Date.now()}`,
                  post_id: postId,
                  user_id: effectiveUserId,
                  author_name: authorName,
                  author_avatar: authorAvatar,
                  content,
                  created_at: parsed.created_at || new Date().toISOString(),
                };

                devPostComments.push(newComment);
                const post = devPosts.find((p) => p.id === postId);
                if (post) {
                  post.comments_count = (post.comments_count || 0) + 1;
                }

                if (post && post.author_id && post.author_id !== effectiveUserId) {
                  devNotifications.unshift({
                    id: `notif-comm-${Date.now()}`,
                    recipient_id: post.author_id,
                    actor_id: effectiveUserId,
                    actor_name: authorName,
                    actor_avatar: authorAvatar,
                    type: 'comment',
                    title: `New comment from ${authorName}`,
                    body: content.length > 80 ? content.slice(0, 80) + '...' : content,
                    post_id: postId,
                    link: 'feed',
                    is_read: 0,
                    created_at: new Date().toISOString(),
                  });
                }

                res.statusCode = 201;
                res.end(JSON.stringify({ success: true, comment: newComment }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: e?.message }));
              }
            });
            return;
          }
        }

        // 3. Posts collection: GET/POST /api/posts
        if (url.pathname === '/api/posts' || url.pathname === '/api/posts/') {
          if (req.method === 'GET') {
            const authorId = url.searchParams.get('author_id') || url.searchParams.get('authorId');
            const groupId = url.searchParams.get('group_id') || url.searchParams.get('groupId');
            const videoOnly = url.searchParams.get('video_only') === 'true' || url.searchParams.get('videos') === 'true';
            const currentRequesterId = url.searchParams.get('viewer_id') || url.searchParams.get('user_id') || userId || '';

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

            // Scopes likes per-user so other users don't see another person's like as their own
            const postsWithUserState = filtered.map((post) => {
              const postLikes = devPostLikes.filter((l) => l.post_id === post.id);
              const isLiked = currentRequesterId
                ? postLikes.some((l) => l.user_id === currentRequesterId)
                : false;

              return {
                ...post,
                is_liked: isLiked,
                liked_by_user_ids: postLikes.map((l) => l.user_id),
              };
            });

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, posts: postsWithUserState }));
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

        // 4. Notifications mark-read: POST /api/notifications/mark-read
        if (url.pathname === '/api/notifications/mark-read' || url.pathname === '/api/notifications/mark-read/') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const targetId = parsed.id;
                const targetIds: string[] = Array.isArray(parsed.ids) ? parsed.ids : [];
                const recipientId = parsed.recipient_id || parsed.user_id || parsed.userId;
                const markAll = Boolean(parsed.all);

                devNotifications = devNotifications.map((n) => {
                  if (targetId && n.id === targetId) return { ...n, is_read: 1 };
                  if (targetIds.includes(n.id)) return { ...n, is_read: 1 };
                  if (markAll || (recipientId && (n.recipient_id === recipientId || n.recipient_id === 'all' || !n.recipient_id))) {
                    return { ...n, is_read: 1 };
                  }
                  return n;
                });

                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, message: 'Notifications marked as read' }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: e?.message }));
              }
            });
            return;
          }
        }

        // 5. Notifications collection: GET/POST /api/notifications
        if (url.pathname === '/api/notifications' || url.pathname === '/api/notifications/') {
          if (req.method === 'GET') {
            const recipientId = url.searchParams.get('recipient_id') || url.searchParams.get('user_id') || userId;
            const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);

            let filtered = [...devNotifications];
            if (recipientId) {
              filtered = filtered.filter((n) => !n.recipient_id || n.recipient_id === 'all' || n.recipient_id === recipientId);
            }
            filtered = filtered.slice(0, limit);

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, notifications: filtered, count: filtered.length }));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const newNotif = {
                  id: parsed.id || `notif-${Date.now()}`,
                  recipient_id: parsed.recipient_id ?? parsed.userId ?? parsed.user_id ?? null,
                  actor_id: parsed.actor_id ?? parsed.actorId ?? userId ?? null,
                  actor_name: parsed.actor_name ?? parsed.actorName ?? parsed.senderName ?? 'Orthodox Parishioner',
                  actor_avatar: parsed.actor_avatar ?? parsed.actorAvatar ?? parsed.senderAvatar ?? null,
                  type: parsed.type || 'system',
                  title: parsed.title || 'Parish Notification',
                  body: parsed.body || parsed.message || '',
                  post_id: parsed.post_id || parsed.postId || null,
                  link: parsed.link || (parsed.post_id ? 'feed' : null),
                  is_read: parsed.is_read || parsed.read ? 1 : 0,
                  created_at: parsed.created_at || new Date().toISOString(),
                };

                devNotifications.unshift(newNotif);
                res.statusCode = 201;
                res.end(JSON.stringify({ success: true, notification: newNotif }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: e?.message }));
              }
            });
            return;
          }
        }

        // 6. Delete notification: DELETE /api/notifications/:id
        if (url.pathname.startsWith('/api/notifications/')) {
          const notifId = url.pathname.replace('/api/notifications/', '').trim();
          if (req.method === 'DELETE') {
            devNotifications = devNotifications.filter((n) => n.id !== notifId);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: notifId, message: 'Notification deleted' }));
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
