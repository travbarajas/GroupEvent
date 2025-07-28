// Debug endpoint to help with admin authentication issues
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_debug_key_2024';

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    // Test what the client is sending
    const providedKey = req.headers.authorization?.replace('Bearer ', '') || req.query.admin_key;
    
    return res.status(200).json({
      message: 'Admin debug info',
      admin_key_set: !!process.env.ADMIN_KEY,
      admin_key_first_5: ADMIN_KEY.substring(0, 5),
      admin_key_length: ADMIN_KEY.length,
      admin_key_full: ADMIN_KEY, // Temporary - remove after debugging
      provided_key: providedKey,
      provided_key_length: providedKey?.length || 0,
      headers_auth: req.headers.authorization,
      query_auth: req.query.admin_key,
      keys_match: providedKey === ADMIN_KEY,
      keys_match_trimmed: providedKey?.trim() === ADMIN_KEY.trim(),
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};