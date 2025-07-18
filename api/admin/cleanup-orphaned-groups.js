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
      // First, add role column if it doesn't exist
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN role VARCHAR(20) DEFAULT 'member'
        `;
        console.log('Added role column to members table');
      } catch (error) {
        console.log('Role column already exists or error:', error.message);
      }
      
      // Update existing members to have 'member' role
      await sql`
        UPDATE members 
        SET role = 'member' 
        WHERE role IS NULL OR role = ''
      `;
      
      // Get all groups with 0 members
      const orphanedGroups = await sql`
        SELECT g.id, g.name
        FROM groups g
        LEFT JOIN members m ON g.id = m.group_id
        GROUP BY g.id, g.name
        HAVING COUNT(m.id) = 0
      `;

      if (orphanedGroups.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No orphaned groups found - database is already clean!',
          deleted_count: 0
        });
      }

      // Delete all orphaned groups (invites will cascade delete)
      const deletedGroups = [];
      for (const group of orphanedGroups) {
        await sql`DELETE FROM groups WHERE id = ${group.id}`;
        deletedGroups.push({
          id: group.id,
          name: group.name
        });
      }

      // Get updated counts
      const [groupCount] = await sql`SELECT COUNT(*) as count FROM groups`;
      const [memberCount] = await sql`SELECT COUNT(*) as count FROM members`;
      const [inviteCount] = await sql`SELECT COUNT(*) as count FROM invites`;

      return res.status(200).json({
        success: true,
        message: `Successfully cleaned up ${deletedGroups.length} orphaned groups!`,
        deleted_count: deletedGroups.length,
        deleted_groups: deletedGroups,
        new_totals: {
          groups: parseInt(groupCount.count),
          members: parseInt(memberCount.count),
          invites: parseInt(inviteCount.count)
        }
      });
    } catch (error) {
      console.error('Error cleaning up orphaned groups:', error);
      return res.status(500).json({ error: 'Failed to cleanup orphaned groups' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};