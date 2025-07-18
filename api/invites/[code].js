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
  const { code } = req.query;

  if (req.method === 'GET') {
    try {
      // Find invite and associated group
      const [invite] = await sql`
        SELECT i.*, g.name as group_name, g.description as group_description, g.member_count
        FROM invites i
        JOIN groups g ON i.group_id = g.id
        WHERE i.invite_code = ${code}
      `;

      if (!invite) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }

      // Check if invite is expired
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Invite has expired' });
      }

      // Check if invite has reached max uses
      if (invite.max_uses && invite.uses_count >= invite.max_uses) {
        return res.status(410).json({ error: 'Invite has reached maximum uses' });
      }

      return res.status(200).json({
        group_id: invite.group_id,
        group_name: invite.group_name,
        group_description: invite.group_description,
        member_count: invite.member_count,
        invite_id: invite.id
      });
    } catch (error) {
      console.error('Error processing invite:', error);
      return res.status(500).json({ error: 'Failed to process invite' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { device_id } = req.body;

      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Find and validate invite
      const [invite] = await sql`
        SELECT i.*, g.id as group_id
        FROM invites i
        JOIN groups g ON i.group_id = g.id
        WHERE i.invite_code = ${code}
      `;

      if (!invite) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }

      // Check if user is already a member
      const [existingMember] = await sql`
        SELECT id FROM members 
        WHERE group_id = ${invite.group_id} AND device_id = ${device_id}
      `;

      if (existingMember) {
        return res.status(200).json({ 
          success: true, 
          group_id: invite.group_id,
          message: 'Already a member of this group'
        });
      }

      // Add user as member with member role
      await sql`
        INSERT INTO members (id, group_id, device_id, role)
        VALUES (${`member_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`}, ${invite.group_id}, ${device_id}, 'member')
      `;

      // Update invite usage count
      await sql`
        UPDATE invites 
        SET uses_count = uses_count + 1 
        WHERE id = ${invite.id}
      `;

      // Update group member count based on actual member count
      await sql`
        UPDATE groups 
        SET member_count = (
          SELECT COUNT(*) FROM members WHERE group_id = ${invite.group_id}
        )
        WHERE id = ${invite.group_id}
      `;

      return res.status(200).json({ 
        success: true, 
        group_id: invite.group_id,
        message: 'Successfully joined group'
      });
    } catch (error) {
      console.error('Error joining group:', error);
      return res.status(500).json({ error: 'Failed to join group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};