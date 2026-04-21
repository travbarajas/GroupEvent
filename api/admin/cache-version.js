const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  const _origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', (_origin === 'https://group-event.vercel.app' || _origin.endsWith('.exp.direct') || _origin === 'http://localhost:8081' || _origin === 'http://localhost:19006') ? _origin : 'https://group-event.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_config (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    if (req.method === 'GET') {
      const rows = await sql`SELECT value FROM app_config WHERE key = 'cache_version'`;
      const version = rows[0]?.value || '0';
      return res.status(200).json({ version });
    }

    if (req.method === 'POST') {
      const newVersion = Date.now().toString();
      await sql`
        INSERT INTO app_config (key, value, updated_at)
        VALUES ('cache_version', ${newVersion}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${newVersion}, updated_at = NOW()
      `;
      return res.status(200).json({ version: newVersion });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Cache version error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
