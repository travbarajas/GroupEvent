const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tag_order (
        id SERIAL PRIMARY KEY,
        tag_name TEXT UNIQUE NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  } catch (e) { /* table may already exist */ }

  try {
    if (req.method === 'GET') {
      const tags = await sql`SELECT tag_name, sort_order FROM tag_order ORDER BY sort_order ASC`;
      return res.status(200).json({ tags });
    }

    if (req.method === 'PUT') {
      const { tags } = req.body;
      if (!tags || !Array.isArray(tags)) {
        return res.status(400).json({ error: 'tags array is required' });
      }
      await sql`DELETE FROM tag_order`;
      for (let i = 0; i < tags.length; i++) {
        await sql`
          INSERT INTO tag_order (tag_name, sort_order)
          VALUES (${tags[i].tag_name}, ${i})
        `;
      }
      return res.status(200).json({ success: true, count: tags.length });
    }

    if (req.method === 'POST') {
      const { tag_name } = req.body;
      if (!tag_name || !tag_name.trim()) {
        return res.status(400).json({ error: 'tag_name is required' });
      }
      const [maxResult] = await sql`SELECT COALESCE(MAX(sort_order), -1) as max_order FROM tag_order`;
      const newOrder = maxResult.max_order + 1;
      const [newTag] = await sql`
        INSERT INTO tag_order (tag_name, sort_order)
        VALUES (${tag_name.trim().toLowerCase()}, ${newOrder})
        ON CONFLICT (tag_name) DO NOTHING
        RETURNING *
      `;
      if (!newTag) {
        return res.status(409).json({ error: 'Tag already exists' });
      }
      return res.status(201).json(newTag);
    }

    if (req.method === 'DELETE') {
      const { tag_name } = req.body;
      if (!tag_name) {
        return res.status(400).json({ error: 'tag_name is required' });
      }
      await sql`DELETE FROM tag_order WHERE tag_name = ${tag_name}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in tags endpoint:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
