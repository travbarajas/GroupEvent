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

      // Check if group exists
      const [group] = await sql`
        SELECT * FROM groups 
        WHERE id = ${id}
      `;

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Decrease member count (minimum 0)
      await sql`
        UPDATE groups 
        SET member_count = GREATEST(member_count - 1, 0)
        WHERE id = ${id}
      `;

      // Get updated group
      const [updatedGroup] = await sql`
        SELECT * FROM groups 
        WHERE id = ${id}
      `;

      return res.status(200).json({ 
        success: true, 
        message: 'Left group successfully',
        group: updatedGroup
      });
    } catch (error) {
      console.error('Error leaving group:', error);
      return res.status(500).json({ error: 'Failed to leave group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};