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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, POST, OPTIONS');
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

      // First check if events table exists and create if needed
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS events (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(500) NOT NULL,
            description TEXT,
            date DATE,
            time TIME,
            location VARCHAR(500),
            venue_name VARCHAR(500),
            price DECIMAL(10,2),
            currency VARCHAR(3) DEFAULT 'USD',
            is_free BOOLEAN DEFAULT false,
            category VARCHAR(100),
            tags TEXT[],
            max_attendees INTEGER,
            min_attendees INTEGER,
            attendance_required BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
      } catch (tableError) {
        console.log('Events table check/creation error:', tableError.message);
      }

      let events;
      try {
        // Get all global events
        events = await sql`
          SELECT 
            *,
            (SELECT COUNT(*) FROM group_events WHERE source_event_id = events.id) as usage_count
          FROM events
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } catch (queryError) {
        console.log('Global events query failed:', queryError.message);
        events = []; // Return empty array if table doesn't exist
      }

      // Get summary stats
      let stats;
      try {
        const statsResult = await sql`
          SELECT 
            COUNT(*) as total_global_events,
            COUNT(CASE WHEN is_free = true THEN 1 END) as free_events,
            COUNT(CASE WHEN is_free = false THEN 1 END) as paid_events,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as events_today,
            COUNT(DISTINCT category) as categories_count
          FROM events
        `;
        stats = statsResult[0];
      } catch (statsError) {
        console.log('Global events stats query failed:', statsError.message);
        stats = {
          total_global_events: 0,
          free_events: 0,
          paid_events: 0,
          events_today: 0,
          categories_count: 0
        };
      }

      return res.status(200).json({
        events,
        stats: stats,
        total_returned: events.length
      });

    } catch (error) {
      console.error('Error fetching admin global events:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description, date, time, location, price, is_free, category } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Event name is required' });
      }

      // Generate a unique event ID
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newEvent = await sql`
        INSERT INTO events (
          id, name, description, date, time, location, price, is_free, category
        )
        VALUES (
          ${eventId}, ${name}, ${description || ''}, ${date || null}, ${time || null}, 
          ${location || ''}, ${price || 0}, ${is_free || true}, ${category || 'general'}
        )
        RETURNING *
      `;

      return res.status(201).json({ 
        success: true, 
        event: newEvent[0] 
      });

    } catch (error) {
      console.error('Error creating global event:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { event_id, delete_all } = req.body;

      if (delete_all === 'confirm') {
        // Delete ALL global events (use with extreme caution!)
        const result = await sql`DELETE FROM events`;
        return res.status(200).json({ 
          success: true, 
          message: `Deleted all global events`,
          deleted_count: result.count 
        });
      }

      if (event_id) {
        // Delete specific global event
        const result = await sql`
          DELETE FROM events 
          WHERE id = ${event_id}
        `;
        
        if (result.count === 0) {
          return res.status(404).json({ error: 'Global event not found' });
        }

        return res.status(200).json({ 
          success: true, 
          message: `Deleted global event ${event_id}` 
        });
      }

      return res.status(400).json({ 
        error: 'Must provide event_id or delete_all=confirm' 
      });

    } catch (error) {
      console.error('Error deleting global event:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};