const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const { groupId, deviceId } = req.query;
      
      if (!groupId || !deviceId) {
        return res.status(400).json({ error: 'groupId and deviceId are required' });
      }

      console.log('🧪 Testing events query with color JOIN');
      
      // Test the JOIN query directly
      const testResult = await sql`
        SELECT 
          e.id,
          e.custom_name,
          e.added_by_device_id as created_by_device_id,
          e.added_by_username as created_by_username,
          m.color as created_by_color,
          m.username as member_username
        FROM group_events e
        LEFT JOIN members m ON e.added_by_device_id = m.device_id AND m.group_id = ${groupId}
        WHERE e.group_id = ${groupId}
        ORDER BY e.added_at DESC
        LIMIT 3
      `;
      
      console.log('🧪 Test query result:', testResult);
      
      return res.status(200).json({ 
        success: true, 
        query: 'LEFT JOIN test',
        results: testResult,
        message: 'Direct JOIN query test'
      });
      
    } catch (error) {
      console.error('🧪 Test query failed:', error);
      return res.status(500).json({ 
        error: 'Test query failed', 
        details: error.message 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};