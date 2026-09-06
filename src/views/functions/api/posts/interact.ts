interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { action, postId, userId, commentText } = await request.json() as any;

    if (!postId || !userId) {
      return new Response(JSON.stringify({ error: "Missing postId or userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1. TOGGLE BLESS / LIKE
    if (action === 'toggle_like') {
      const existing = await env.DB.prepare(
        "SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?"
      ).bind(postId, userId).first();

      if (existing) {
        // Remove ONLY this user's like
        await env.DB.batch([
          env.DB.prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?").bind(postId, userId),
          env.DB.prepare(
            "UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = ?) WHERE id = ?"
          ).bind(postId, postId)
        ]);

        const countRes = await env.DB.prepare("SELECT likes_count FROM posts WHERE id = ?").bind(postId).first<{ likes_count: number }>();
        return new Response(JSON.stringify({ success: true, liked: false, likesCount: countRes?.likes_count ?? 0 }), {
          headers: { "Content-Type": "application/json" }
        });
      } else {
        // Add like for this user
        const newId = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO post_likes (id, post_id, user_id, created_at) VALUES (?, ?, ?, datetime('now'))"
          ).bind(newId, postId, userId),
          env.DB.prepare(
            "UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = ?) WHERE id = ?"
          ).bind(postId, postId)
        ]);

        const countRes = await env.DB.prepare("SELECT likes_count FROM posts WHERE id = ?").bind(postId).first<{ likes_count: number }>();
        return new Response(JSON.stringify({ success: true, liked: true, likesCount: countRes?.likes_count ?? 1 }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. ADD COMMENT
    if (action === 'add_comment') {
      if (!commentText || !commentText.trim()) {
        return new Response(JSON.stringify({ error: "Comment cannot be empty" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const commentId = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO post_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).bind(commentId, postId, userId, commentText.trim()),
        env.DB.prepare(
          "UPDATE posts SET comments_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = ?) WHERE id = ?"
        ).bind(postId, postId)
      ]);

      return new Response(JSON.stringify({ success: true, commentId }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
