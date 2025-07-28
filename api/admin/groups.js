const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

// Simple admin key for security (you can change this)
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin_debug_key_2024';

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple admin authentication
  const adminKey = req.headers.authorization?.replace('Bearer ', '') || req.query.admin_key;
  
  if (!adminKey || adminKey.trim() !== ADMIN_KEY.trim()) {
    return res.status(401).json({ 
      error: 'Unauthorized - Invalid admin key'
    });
  }

  if (req.method === 'GET') {
    try {
      const { limit = 100 } = req.query;

      // Get all groups with member count and latest activity
      const groups = await sql`
        SELECT 
          g.*,
          COUNT(DISTINCT m.device_id) as actual_member_count,
          COUNT(DISTINCT ge.id) as event_count,
          MAX(ge.added_at) as last_event_added,
          MAX(m.joined_at) as last_member_joined
        FROM groups g
        LEFT JOIN members m ON g.id = m.group_id
        LEFT JOIN group_events ge ON g.id = ge.group_id
        GROUP BY g.id, g.name, g.description, g.member_count, g.created_at, g.updated_at
        ORDER BY g.created_at DESC
        LIMIT ${parseInt(limit)}
      `;

      // Get summary stats
      const stats = await sql`
        SELECT 
          COUNT(DISTINCT g.id) as total_groups,
          COUNT(DISTINCT m.device_id) as total_members,
          COUNT(DISTINCT ge.id) as total_group_events,
          COUNT(CASE WHEN g.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as groups_today
        FROM groups g
        LEFT JOIN members m ON g.id = m.group_id
        LEFT JOIN group_events ge ON g.id = ge.group_id
      `;

      return res.status(200).json({
        groups,
        stats: stats[0],
        total_returned: groups.length
      });

    } catch (error) {
      console.error('Error fetching admin groups:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { group_id, delete_all, cleanup_empty } = req.body;

      if (delete_all === 'confirm') {
        // Delete ALL groups (use with extreme caution!)
        const result = await sql`DELETE FROM groups`;
        return res.status(200).json({ 
          success: true, 
          message: `Deleted all groups`,
          deleted_count: result.count 
        });
      }

      if (cleanup_empty === 'confirm') {
        // Delete groups with no members (orphaned groups)
        const emptyGroups = await sql`
          SELECT g.id, g.name 
          FROM groups g
          LEFT JOIN members m ON g.id = m.group_id
          WHERE m.group_id IS NULL
        `;
        
        if (emptyGroups.length > 0) {
          const result = await sql`
            DELETE FROM groups 
            WHERE id IN (
              SELECT g.id 
              FROM groups g
              LEFT JOIN members m ON g.id = m.group_id
              WHERE m.group_id IS NULL
            )
          `;
          
          return res.status(200).json({ 
            success: true, 
            message: `Cleaned up ${result.count} empty groups`,
            deleted_count: result.count,
            deleted_groups: emptyGroups.map(g => ({ id: g.id, name: g.name }))
          });
        } else {
          return res.status(200).json({ 
            success: true, 
            message: 'No empty groups found to clean up',
            deleted_count: 0
          });
        }
      }

      if (group_id) {
        // Delete specific group (cascades to members and events)
        const result = await sql`
          DELETE FROM groups 
          WHERE id = ${group_id}
        `;
        
        if (result.count === 0) {
          return res.status(404).json({ error: 'Group not found' });
        }

        return res.status(200).json({ 
          success: true, 
          message: `Deleted group ${group_id}` 
        });
      }

      return res.status(400).json({ 
        error: 'Must provide group_id, delete_all=confirm, or cleanup_empty=confirm' 
      });

    } catch (error) {
      console.error('Error deleting admin groups:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};