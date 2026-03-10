const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable is required');
}

module.exports = async function handler(req, res) {
  const _origin = req.headers.origin || ''; res.setHeader('Access-Control-Allow-Origin', (_origin === 'https://group-event.vercel.app' || _origin.endsWith('.exp.direct')) ? _origin : 'https://group-event.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, error: 'Password required' });
  }

  // Use timing-safe comparison to prevent timing attacks
  const provided = Buffer.from(String(password));
  const expected = Buffer.from(ADMIN_PASSWORD);
  const match =
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected);

  if (!match) {
    return res.status(401).json({ success: false });
  }

  return res.status(200).json({ success: true });
};
