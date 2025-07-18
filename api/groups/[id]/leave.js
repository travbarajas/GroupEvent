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

      // Check if user is a member of this group and get their role
      const [member] = await sql`
        SELECT id, role FROM members 
        WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!member) {
        return res.status(404).json({ error: 'You are not a member of this group' });
      }

      const isCreator = member.role === 'creator';

      // Remove member record
      await sql`
        DELETE FROM members 
        WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      // Check if any members are left
      const [memberCount] = await sql`
        SELECT COUNT(*) as count FROM members WHERE group_id = ${id}
      `;

      if (memberCount.count === 0) {
        // No members left, delete the group and all related data
        // Invites will be deleted automatically due to CASCADE constraint
        await sql`
          DELETE FROM groups WHERE id = ${id}
        `;

        return res.status(200).json({ 
          success: true, 
          message: 'Left group successfully. Group has been deleted as it had no remaining members.'
        });
      } else {
        // If the creator left and there are remaining members, transfer creator role
        if (isCreator) {
          // Find the oldest remaining member (joined first) to become the new creator
          const [newCreator] = await sql`
            SELECT id, device_id
            FROM members 
            WHERE group_id = ${id} 
            ORDER BY id ASC 
            LIMIT 1
          `;

          if (newCreator) {
            // Update the oldest member to be the new creator
            await sql`
              UPDATE members 
              SET role = 'creator' 
              WHERE id = ${newCreator.id}
            `;
            console.log(`Transferred creator role to member ${newCreator.id} (device: ${newCreator.device_id})`);
          }
        }

        // Update group member count based on remaining members
        await sql`
          UPDATE groups 
          SET member_count = ${memberCount.count}
          WHERE id = ${id}
        `;

        const transferMessage = isCreator ? ' Creator role has been transferred to the next member.' : '';
        return res.status(200).json({ 
          success: true, 
          message: `Left group successfully.${transferMessage}`,
          creator_transferred: isCreator
        });
      }
    } catch (error) {
      console.error('Error leaving group:', error);
      return res.status(500).json({ error: 'Failed to leave group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};