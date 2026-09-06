interface Env {
  DB: D1Database;
}

// GET /api/books (Fetch books with search & category filters)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { searchParams } = new URL(context.request.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q') || '';

  try {
    let query = `SELECT * FROM books WHERE 1=1`;
    const params: any[] = [];

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (q.trim()) {
      query += ` AND (title_ar LIKE ? OR title_en LIKE ? OR author_ar LIKE ? OR author_en LIKE ?)`;
      const searchPattern = `%${q.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY created_at DESC`;

    const { results } = await context.env.DB.prepare(query).bind(...params).all();
    return Response.json(results || []);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

// POST /api/books (Save new book)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json();
    const {
      id,
      title_ar,
      title_en,
      author_ar,
      author_en,
      category,
      cover_image_url,
      file_url,
      description,
    } = body;

    if (!title_ar || !author_ar || !file_url) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await context.env.DB.prepare(
      `INSERT INTO books (
        id, title_ar, title_en, author_ar, author_en, category, cover_image_url, file_url, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        id || `book-${Date.now()}`,
        title_ar,
        title_en || null,
        author_ar,
        author_en || null,
        category || 'patristics',
        cover_image_url || null,
        file_url,
        description || null
      )
      .run();

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
