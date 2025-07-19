const { neon } = require('@neondatabase/serverless');

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
      const { id } = req.query;
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Get all members with their usernames for this group
      const members = await sql`
        SELECT 
          m.id as member_id,
          m.device_id,
          m.role,
          m.username,
          m.profile_picture,
          CASE WHEN m.username IS NOT NULL AND LENGTH(TRIM(m.username)) > 0 
               THEN true 
               ELSE false 
          END as has_username
        FROM members m
        WHERE m.group_id = ${id}
        ORDER BY m.id ASC
      `;
      
      return res.status(200).json(members);
    } catch (error) {
      console.error('Error fetching group members:', error);
      return res.status(500).json({ error: 'Failed to fetch group members' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};