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

      // Check if user is a member and get their role
      const [member] = await sql`
        SELECT role 
        FROM members 
        WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!member) {
        return res.status(404).json({ 
          error: 'You are not a member of this group',
          is_member: false,
          is_creator: false,
          role: null
        });
      }

      return res.status(200).json({
        is_member: true,
        is_creator: member.role === 'creator',
        role: member.role,
        permissions: {
          can_invite: member.role === 'creator',
          can_leave: true, // Everyone can leave
          can_delete_group: member.role === 'creator'
        }
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
      return res.status(500).json({ error: 'Failed to check permissions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};