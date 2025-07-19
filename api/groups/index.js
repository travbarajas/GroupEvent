const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const { device_id, user_info } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // If user_info parameter is present, return user info instead of groups
      if (user_info === 'true') {
        const [member] = await sql`
          SELECT username, 
                 CASE WHEN username IS NOT NULL AND LENGTH(TRIM(username)) > 0 
                      THEN true 
                      ELSE false 
                 END as has_username
          FROM members 
          WHERE device_id = ${device_id} 
          LIMIT 1
        `;
        
        if (!member) {
          return res.status(200).json({ 
            username: null, 
            has_username: false 
          });
        }
        
        return res.status(200).json(member);
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

      // Ensure username column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN username VARCHAR(50)
        `;
        console.log('Added username column to members table');
      } catch (error) {
        console.log('Username column already exists or error:', error.message);
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

  if (req.method === 'PUT') {
    try {
      const { device_id, username } = req.body;
      
      if (!device_id || !username) {
        return res.status(400).json({ error: 'device_id and username are required' });
      }

      // Update username for this device across all groups they're in
      await sql`
        UPDATE members 
        SET username = ${username.trim()}
        WHERE device_id = ${device_id}
      `;
      
      return res.status(200).json({ success: true, message: 'Username updated successfully' });
    } catch (error) {
      console.error('Error updating username:', error);
      return res.status(500).json({ error: 'Failed to update username' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};