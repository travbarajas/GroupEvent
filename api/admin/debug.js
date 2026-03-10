const crypto = require('crypto');

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async function handler(req, res) {
  // Enable CORS
  const _origin = req.headers.origin || ''; res.setHeader('Access-Control-Allow-Origin', (_origin === 'https://group-event.vercel.app' || _origin.endsWith('.exp.direct')) ? _origin : 'https://group-event.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get admin key from Authorization header only (never accept in query string — it appears in logs)
  const adminKey = req.headers.authorization?.replace('Bearer ', '');

  if (!ADMIN_KEY) {
    return res.status(500).json({
      error: 'ADMIN_KEY not configured on server',
      keys_match: false
    });
  }

  if (!adminKey) {
    return res.status(401).json({
      error: 'No admin key provided',
      keys_match: false
    });
  }

  const providedBuf = Buffer.from(adminKey.trim());
  const expectedBuf = Buffer.from(ADMIN_KEY.trim());
  const keysMatch =
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!keysMatch) {
    return res.status(401).json({
      error: 'Invalid admin key',
      keys_match: false
    });
  }

  return res.status(200).json({
    keys_match: true,
    message: 'Authentication successful'
  });
};
