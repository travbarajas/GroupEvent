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
  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid admin key' });
  }

  if (req.method === 'GET') {
    try {
      const { group_id, limit = 100 } = req.query;

      let query;
      let params = [];

      if (group_id) {
        // Get events for specific group
        query = `
          SELECT 
            ge.*,
            g.name as group_name
          FROM group_events ge
          LEFT JOIN groups g ON ge.group_id = g.id
          WHERE ge.group_id = $1
          ORDER BY ge.added_at DESC
          LIMIT $2
        `;
        params = [group_id, parseInt(limit)];
      } else {
        // Get all events across all groups
        query = `
          SELECT 
            ge.*,
            g.name as group_name,
            g.member_count
          FROM group_events ge
          LEFT JOIN groups g ON ge.group_id = g.id
          ORDER BY ge.added_at DESC
          LIMIT $1
        `;
        params = [parseInt(limit)];
      }

      const events = await sql(query, params);

      // Get summary stats
      const stats = await sql`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT group_id) as total_groups,
          COUNT(CASE WHEN source_type = 'custom' THEN 1 END) as custom_events,
          COUNT(CASE WHEN added_at > NOW() - INTERVAL '24 hours' THEN 1 END) as events_today
        FROM group_events
      `;

      return res.status(200).json({
        events,
        stats: stats[0],
        total_returned: events.length
      });

    } catch (error) {
      console.error('Error fetching admin events:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { event_id, group_id, delete_all } = req.body;

      if (delete_all === 'confirm') {
        // Delete ALL events (use with extreme caution!)
        const result = await sql`DELETE FROM group_events`;
        return res.status(200).json({ 
          success: true, 
          message: `Deleted all events`,
          deleted_count: result.count 
        });
      }

      if (event_id) {
        // Delete specific event
        const result = await sql`
          DELETE FROM group_events 
          WHERE id = ${event_id}
        `;
        
        if (result.count === 0) {
          return res.status(404).json({ error: 'Event not found' });
        }

        return res.status(200).json({ 
          success: true, 
          message: `Deleted event ${event_id}` 
        });
      }

      if (group_id) {
        // Delete all events from a specific group
        const result = await sql`
          DELETE FROM group_events 
          WHERE group_id = ${group_id}
        `;
        
        return res.status(200).json({ 
          success: true, 
          message: `Deleted ${result.count} events from group ${group_id}`,
          deleted_count: result.count
        });
      }

      return res.status(400).json({ 
        error: 'Must provide event_id, group_id, or delete_all=confirm' 
      });

    } catch (error) {
      console.error('Error deleting admin events:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};