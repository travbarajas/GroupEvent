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
  
  const { action } = req.query;
  
  // GET /api/admin?action=stats - Database statistics
  if (req.method === 'GET' && action === 'stats') {
    try {
      // Get all groups (including orphaned ones)
      const allGroups = await sql`
        SELECT g.*, 
               COALESCE(m.member_count, 0) as actual_members,
               COALESCE(i.invite_count, 0) as invite_count
        FROM groups g
        LEFT JOIN (
          SELECT group_id, COUNT(*) as member_count 
          FROM members 
          GROUP BY group_id
        ) m ON g.id = m.group_id
        LEFT JOIN (
          SELECT group_id, COUNT(*) as invite_count 
          FROM invites 
          GROUP BY group_id
        ) i ON g.id = i.group_id
        ORDER BY g.created_at DESC
      `;

      // Get orphaned groups (groups with 0 members)
      const orphanedGroups = allGroups.filter(g => g.actual_members === 0);

      // Get total counts
      const [groupCount] = await sql`SELECT COUNT(*) as count FROM groups`;
      const [memberCount] = await sql`SELECT COUNT(*) as count FROM members`;
      const [inviteCount] = await sql`SELECT COUNT(*) as count FROM invites`;

      // Get groups by member count
      const groupsByMemberCount = await sql`
        SELECT 
          COALESCE(m.member_count, 0) as member_count,
          COUNT(*) as group_count
        FROM groups g
        LEFT JOIN (
          SELECT group_id, COUNT(*) as member_count 
          FROM members 
          GROUP BY group_id
        ) m ON g.id = m.group_id
        GROUP BY COALESCE(m.member_count, 0)
        ORDER BY member_count
      `;

      return res.status(200).json({
        summary: {
          total_groups: parseInt(groupCount.count),
          total_members: parseInt(memberCount.count),
          total_invites: parseInt(inviteCount.count),
          orphaned_groups: orphanedGroups.length
        },
        groups_by_member_count: groupsByMemberCount,
        all_groups: allGroups,
        orphaned_groups: orphanedGroups,
        message: orphanedGroups.length > 0 
          ? `Warning: ${orphanedGroups.length} groups have no members and should be deleted!`
          : 'Database is clean - no orphaned groups found!'
      });
    } catch (error) {
      console.error('Error getting database stats:', error);
      return res.status(500).json({ error: 'Failed to get database stats' });
    }
  }
  
  // POST /api/admin?action=cleanup - Clean up orphaned groups
  if (req.method === 'POST' && action === 'cleanup') {
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
  
  // POST /api/admin?action=add-role-column - Add role column to members
  if (req.method === 'POST' && action === 'add-role-column') {
    try {
      console.log('Adding role column to members table...');
      
      // First, try to add the role column if it doesn't exist
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN role VARCHAR(20) DEFAULT 'member'
        `;
        console.log('Successfully added role column');
      } catch (error) {
        // Column might already exist, that's OK
        console.log('Role column might already exist:', error.message);
      }
      
      // Update existing members to have 'member' role if they don't have a role
      const updateResult = await sql`
        UPDATE members 
        SET role = 'member' 
        WHERE role IS NULL OR role = ''
      `;
      console.log('Updated existing members:', updateResult);
      
      // Get all members to show current state
      const allMembers = await sql`
        SELECT m.*, g.name as group_name 
        FROM members m
        JOIN groups g ON m.group_id = g.id
        ORDER BY m.group_id, m.id
      `;
      
      return res.status(200).json({
        success: true,
        message: 'Role column added and existing members updated',
        members: allMembers,
        updated_count: updateResult.length || 0
      });
    } catch (error) {
      console.error('Error adding role column:', error);
      return res.status(500).json({ 
        error: 'Failed to add role column',
        details: error.message 
      });
    }
  }

  return res.status(400).json({ 
    error: 'Invalid action. Use ?action=stats, ?action=cleanup, or ?action=add-role-column' 
  });
};