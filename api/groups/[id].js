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
      const { id, device_id, profile } = req.query;

      // If profile parameter is present, return user's profile for this group
      if (profile === 'true' && device_id) {
        const [member] = await sql`
          SELECT username, profile_picture,
                 CASE WHEN username IS NOT NULL AND LENGTH(TRIM(username)) > 0 
                      THEN true 
                      ELSE false 
                 END as has_username
          FROM members 
          WHERE group_id = ${id} AND device_id = ${device_id}
        `;
        
        if (!member) {
          return res.status(404).json({ error: 'You are not a member of this group' });
        }
        
        return res.status(200).json(member);
      }

      // Get group with its invite code
      const [group] = await sql`
        SELECT g.*, i.invite_code
        FROM groups g
        LEFT JOIN invites i ON g.id = i.group_id
        WHERE g.id = ${id}
        LIMIT 1
      `;

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.status(200).json(group);
    } catch (error) {
      console.error('Error fetching group:', error);
      return res.status(500).json({ error: 'Failed to fetch group' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { device_id, username, profile_picture } = req.body;
      
      if (!device_id || !username) {
        return res.status(400).json({ error: 'device_id and username are required' });
      }

      // Update username and profile picture for this specific group membership
      const [updatedMember] = await sql`
        UPDATE members 
        SET username = ${username.trim()}, profile_picture = ${profile_picture || null}
        WHERE group_id = ${id} AND device_id = ${device_id}
        RETURNING username, profile_picture
      `;

      if (!updatedMember) {
        return res.status(404).json({ error: 'You are not a member of this group' });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Profile updated successfully',
        username: updatedMember.username,
        profile_picture: updatedMember.profile_picture
      });
    } catch (error) {
      console.error('Error updating group profile:', error);
      return res.status(500).json({ error: 'Failed to update group profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};