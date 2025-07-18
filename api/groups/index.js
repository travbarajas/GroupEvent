const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const groups = await sql`SELECT * FROM groups ORDER BY created_at DESC`;
      return res.status(200).json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('POST request received:', req.body);
      
      const { name, description } = req.body;
      
      if (!name || name.trim().length === 0) {
        console.log('Validation failed: missing name');
        return res.status(400).json({ error: 'Group name is required' });
      }

      const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      console.log('Creating group with ID:', groupId);
      
      // Create group
      const [group] = await sql`
        INSERT INTO groups (id, name, description)
        VALUES (${groupId}, ${name.trim()}, ${description || null})
        RETURNING *
      `;

      console.log('Group created:', group);

      // Create default invite
      await sql`
        INSERT INTO invites (id, group_id, invite_code, created_by)
        VALUES (${`invite_${Date.now()}`}, ${groupId}, ${inviteCode}, 'creator')
      `;

      console.log('Invite created with code:', inviteCode);

      return res.status(201).json({ 
        ...group, 
        invite_code: inviteCode 
      });
    } catch (error) {
      console.error('Detailed error creating group:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Failed to create group', 
        details: error.message,
        type: error.constructor.name
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};