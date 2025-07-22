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
  
  if (req.method === 'GET') {
    try {
      const { group_id, device_id } = req.query;
      
      if (!group_id) {
        return res.status(400).json({ error: 'group_id is required' });
      }
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${group_id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Get all events for this group
      const events = await sql`
        SELECT 
          e.id,
          e.custom_name,
          e.original_event_data,
          e.created_at,
          e.created_by_device_id,
          m.username as created_by_username
        FROM group_events e
        LEFT JOIN members m ON e.created_by_device_id = m.device_id AND m.group_id = ${group_id}
        WHERE e.group_id = ${group_id}
        ORDER BY e.created_at DESC
      `;
      
      return res.status(200).json({ events });
    } catch (error) {
      console.error('Error fetching group events:', error);
      return res.status(500).json({ error: 'Failed to fetch group events' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { group_id, device_id, custom_name, original_event } = req.body;
      
      if (!group_id) {
        return res.status(400).json({ error: 'group_id is required' });
      }
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!original_event) {
        return res.status(400).json({ error: 'original_event data is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${group_id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Ensure group_events table exists
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS group_events (
            id VARCHAR(255) PRIMARY KEY,
            group_id VARCHAR(255) NOT NULL,
            custom_name TEXT,
            original_event_data JSONB NOT NULL,
            created_by_device_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
          )
        `;
      } catch (error) {
        console.log('Table already exists or error:', error.message);
      }

      const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Save event to group
      const [savedEvent] = await sql`
        INSERT INTO group_events (id, group_id, custom_name, original_event_data, created_by_device_id)
        VALUES (${eventId}, ${group_id}, ${custom_name || null}, ${JSON.stringify(original_event)}, ${device_id})
        RETURNING *
      `;
      
      return res.status(201).json({ 
        success: true,
        event: savedEvent
      });
    } catch (error) {
      console.error('Error saving event to group:', error);
      return res.status(500).json({ error: 'Failed to save event to group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};