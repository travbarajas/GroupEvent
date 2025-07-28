// Debug endpoint to help with admin authentication issues
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_debug_key_2024';

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'Admin debug info',
      admin_key_set: !!process.env.ADMIN_KEY,
      admin_key_first_5: ADMIN_KEY.substring(0, 5),
      admin_key_length: ADMIN_KEY.length,
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};