const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    try {
      const { id } = req.query;
      const { device_id } = req.body;

      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [member] = await sql`
        SELECT id FROM members 
        WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!member) {
        return res.status(404).json({ error: 'You are not a member of this group' });
      }

      // Remove member record
      await sql`
        DELETE FROM members 
        WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      // Update group member count based on remaining members
      await sql`
        UPDATE groups 
        SET member_count = (
          SELECT COUNT(*) FROM members WHERE group_id = ${id}
        )
        WHERE id = ${id}
      `;

      return res.status(200).json({ 
        success: true, 
        message: 'Left group successfully'
      });
    } catch (error) {
      console.error('Error leaving group:', error);
      return res.status(500).json({ error: 'Failed to leave group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};