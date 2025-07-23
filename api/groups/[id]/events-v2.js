const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

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
      const { id } = req.query;
      const { device_id } = req.query;
      
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

      // Get all events for this group using new reference system
      const events = await sql`
        SELECT 
          e.id,
          e.name,
          e.description,
          e.date,
          e.time,
          e.location,
          e.venue_name,
          e.price,
          e.currency,
          e.is_free,
          e.category,
          e.tags,
          e.max_attendees,
          e.min_attendees,
          e.attendance_required,
          
          -- Group-specific data
          ge.custom_name,
          ge.added_by_device_id as created_by_device_id,
          ge.added_at as created_at,
          m.username as created_by_username,
          
          -- Group event data (attendance, expenses, etc.)
          ged.attendance_going,
          ged.attendance_maybe,
          ged.attendance_not_going,
          ged.expenses,
          ged.notes
          
        FROM group_event_refs ge
        JOIN events e ON ge.event_id = e.id
        LEFT JOIN members m ON ge.added_by_device_id = m.device_id AND m.group_id = ${id}
        LEFT JOIN group_event_data ged ON ge.group_id = ged.group_id AND ge.event_id = ged.event_id
        WHERE ge.group_id = ${id}
        ORDER BY ge.added_at DESC
      `;
      
      return res.status(200).json({ events });
    } catch (error) {
      console.error('Error fetching group events:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id } = req.query;
      const { device_id, event_id, custom_name } = req.body;
      
      if (!device_id || !event_id) {
        return res.status(400).json({ error: 'device_id and event_id are required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Verify event exists in global registry
      const [eventExists] = await sql`
        SELECT 1 FROM events WHERE id = ${event_id}
      `;

      if (!eventExists) {
        return res.status(404).json({ error: 'Event not found in registry' });
      }

      // Create tables if they don't exist
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS group_event_refs (
            group_id VARCHAR(255),
            event_id VARCHAR(255),
            custom_name VARCHAR(500),
            added_by_device_id VARCHAR(255) NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, event_id),
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS group_event_data (
            group_id VARCHAR(255),
            event_id VARCHAR(255),
            attendance_going TEXT[],
            attendance_maybe TEXT[],
            attendance_not_going TEXT[],
            expenses JSONB,
            notes TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, event_id)
          )
        `;
      } catch (error) {
        console.log('Table creation:', error.message);
      }

      // Add event reference to group
      const [eventRef] = await sql`
        INSERT INTO group_event_refs (group_id, event_id, custom_name, added_by_device_id)
        VALUES (${id}, ${event_id}, ${custom_name}, ${device_id})
        ON CONFLICT (group_id, event_id) 
        DO UPDATE SET 
          custom_name = ${custom_name},
          added_by_device_id = ${device_id},
          added_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      // Initialize empty group event data
      await sql`
        INSERT INTO group_event_data (group_id, event_id, attendance_going, attendance_maybe, attendance_not_going, expenses)
        VALUES (${id}, ${event_id}, '{}', '{}', '{}', '{}')
        ON CONFLICT (group_id, event_id) DO NOTHING
      `;
      
      return res.status(201).json({ success: true, event_ref: eventRef });

    } catch (error) {
      console.error('Error adding event to group:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};