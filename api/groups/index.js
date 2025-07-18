const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Only return groups where the user is a member
      const groups = await sql`
        SELECT g.*, COUNT(m.id) as actual_member_count
        FROM groups g
        INNER JOIN members m ON g.id = m.group_id
        WHERE g.id IN (
          SELECT group_id FROM members WHERE device_id = ${device_id}
        )
        GROUP BY g.id, g.name, g.description, g.member_count, g.created_at, g.updated_at
        ORDER BY g.created_at DESC
      `;
      
      return res.status(200).json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('POST request received:', req.body);
      
      // First, ensure role column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN role VARCHAR(20) DEFAULT 'member'
        `;
        console.log('Added role column to members table');
      } catch (error) {
        console.log('Role column already exists or error:', error.message);
      }
      
      const { name, description, device_id } = req.body;
      
      if (!name || name.trim().length === 0) {
        console.log('Validation failed: missing name');
        return res.status(400).json({ error: 'Group name is required' });
      }

      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
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

      // Add creator as member with creator role
      await sql`
        INSERT INTO members (id, group_id, device_id, role)
        VALUES (${`member_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`}, ${groupId}, ${device_id}, 'creator')
      `;

      // Create default invite
      const inviteResult = await sql`
        INSERT INTO invites (id, group_id, invite_code, created_by)
        VALUES (${`invite_${Date.now()}`}, ${groupId}, ${inviteCode}, ${device_id})
        RETURNING *
      `;

      console.log('Invite created successfully:', inviteResult);
      console.log('Invite code:', inviteCode);

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