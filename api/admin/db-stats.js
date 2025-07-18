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

  return res.status(405).json({ error: 'Method not allowed' });
};