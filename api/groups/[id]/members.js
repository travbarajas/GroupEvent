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
      const { id } = req.query;
      const { device_id, events } = req.query;

      // If events parameter is present, return group events instead of members
      if (events === 'true') {
        if (!device_id) {
          return res.status(400).json({ error: 'device_id is required' });
        }

        // Check if user is a member of this group
        const [membership] = await sql`
          SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
        `;

        if (!membership) {
          return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Get all events for this group with creator colors
        try {
          // Ensure color column exists
          try {
            await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#60a5fa'`;
          } catch (error) {
            // Column already exists
          }
          
          const groupEvents = await sql`
            SELECT 
              e.id,
              e.custom_name,
              e.original_event_data,
              e.created_at,
              e.created_by_device_id,
              m.username as created_by_username,
              COALESCE(m.color, '#2a2a2a') as created_by_color
            FROM group_events e
            LEFT JOIN members m ON e.created_by_device_id = m.device_id AND m.group_id = ${id}
            WHERE e.group_id = ${id}
            ORDER BY e.created_at DESC
          `;
          
          return res.status(200).json({ events: groupEvents });
        } catch (error) {
          console.error('Error fetching group events:', error);
          // If table doesn't exist yet, return empty events
          return res.status(200).json({ events: [] });
        }
      }
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Ensure color column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN color VARCHAR(7) DEFAULT '#60a5fa'
        `;
      } catch (error) {
        // Column already exists
      }

      // Get all members with their usernames and colors for this group
      const members = await sql`
        SELECT 
          m.id as member_id,
          m.device_id,
          m.role,
          m.username,
          m.profile_picture,
          m.color,
          CASE WHEN m.username IS NOT NULL AND LENGTH(TRIM(m.username)) > 0 
               THEN true 
               ELSE false 
          END as has_username,
          CASE WHEN m.color IS NOT NULL AND LENGTH(TRIM(m.color)) > 0 
               THEN true 
               ELSE false 
          END as has_color
        FROM members m
        WHERE m.group_id = ${id}
        ORDER BY m.id ASC
      `;
      
      return res.status(200).json(members);
    } catch (error) {
      console.error('Error fetching group members:', error);
      return res.status(500).json({ error: 'Failed to fetch group members' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id } = req.query;
      const { device_id, custom_name, original_event } = req.body;
      
      console.log('POST to members endpoint:', req.body);
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      if (!original_event) {
        return res.status(400).json({ error: 'original_event data is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
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
        console.log('Table creation error:', error.message);
      }

      const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Save event to group
      const [savedEvent] = await sql`
        INSERT INTO group_events (id, group_id, custom_name, original_event_data, created_by_device_id)
        VALUES (${eventId}, ${id}, ${custom_name || null}, ${JSON.stringify(original_event)}, ${device_id})
        RETURNING *
      `;
      
      return res.status(201).json({ 
        success: true,
        event: savedEvent
      });
    } catch (error) {
      console.error('Error saving event via members endpoint:', error);
      return res.status(500).json({ error: 'Failed to save event to group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};