const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

// Require admin key from environment variable (no default for security)
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!ADMIN_KEY) {
  throw new Error('ADMIN_KEY environment variable is required for admin endpoints');
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Admin authentication - only accept from Authorization header (not query string for security)
  const adminKey = req.headers.authorization?.replace('Bearer ', '');

  console.log('Admin auth attempt:', {
    has_key: !!adminKey,
    timestamp: new Date().toISOString()
  });

  if (!adminKey || adminKey.trim() !== ADMIN_KEY.trim()) {
    return res.status(401).json({
      error: 'Unauthorized - Invalid or missing admin key'
    });
  }

  if (req.method === 'GET') {
    try {
      const { group_id, limit = 100 } = req.query;

      // First check if group_events table exists and create if needed
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS group_events (
            id VARCHAR(255) PRIMARY KEY,
            group_id VARCHAR(255) NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
          )
        `;
      } catch (tableError) {
        console.log('Table check/creation error:', tableError.message);
      }

      let events;

      try {
        if (group_id) {
          // Get events for specific group
          events = await sql`
            SELECT 
              ge.*,
              g.name as group_name
            FROM group_events ge
            LEFT JOIN groups g ON ge.group_id = g.id
            WHERE ge.group_id = ${group_id}
            ORDER BY ge.added_at DESC
            LIMIT ${parseInt(limit)}
          `;
        } else {
          // Get all events across all groups
          events = await sql`
            SELECT 
              ge.*,
              g.name as group_name,
              g.member_count
            FROM group_events ge
            LEFT JOIN groups g ON ge.group_id = g.id
            ORDER BY ge.added_at DESC
            LIMIT ${parseInt(limit)}
          `;
        }
      } catch (queryError) {
        console.log('Events query failed:', queryError.message);
        events = []; // Return empty array if table doesn't exist or query fails
      }

      // Get summary stats with error handling
      let stats;
      try {
        const statsResult = await sql`
          SELECT 
            COUNT(*) as total_events,
            COUNT(DISTINCT group_id) as total_groups,
            COUNT(CASE WHEN source_type = 'custom' THEN 1 END) as custom_events,
            COUNT(CASE WHEN added_at > NOW() - INTERVAL '24 hours' THEN 1 END) as events_today
          FROM group_events
        `;
        stats = statsResult[0];
      } catch (statsError) {
        console.log('Stats query failed:', statsError.message);
        stats = {
          total_events: 0,
          total_groups: 0,
          custom_events: 0,
          events_today: 0
        };
      }

      return res.status(200).json({
        events,
        stats: stats,
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