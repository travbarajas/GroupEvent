const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(device_id)
    )
  `;
}

module.exports = async function handler(req, res) {
  const _origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', (_origin === 'https://group-event.vercel.app' || _origin.endsWith('.exp.direct')) ? _origin : 'https://group-event.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureTable();
  } catch (err) {
    console.log('Table may already exist:', err.message);
  }

  // POST /api/push-tokens — register or update a token for a device
  if (req.method === 'POST') {
    const { device_id, token } = req.body;

    if (!device_id || !token) {
      return res.status(400).json({ error: 'device_id and token are required' });
    }

    await sql`
      INSERT INTO push_tokens (device_id, token, updated_at)
      VALUES (${device_id}, ${token}, CURRENT_TIMESTAMP)
      ON CONFLICT (device_id) DO UPDATE SET
        token = EXCLUDED.token,
        updated_at = CURRENT_TIMESTAMP
    `;

    return res.status(200).json({ success: true });
  }

  // GET /api/push-tokens — fetch all tokens (used by send endpoint)
  if (req.method === 'GET') {
    const tokens = await sql`SELECT token FROM push_tokens`;
    return res.status(200).json({ tokens: tokens.map(r => r.token) });
  }

  // DELETE /api/push-tokens — remove a token (e.g. user opts out)
  if (req.method === 'DELETE') {
    const { device_id } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });
    await sql`DELETE FROM push_tokens WHERE device_id = ${device_id}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
