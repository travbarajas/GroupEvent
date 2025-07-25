const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

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
      const { id } = req.query;
      const { device_id, name, description, date, time, location } = req.body;
      
      if (!device_id || !name || !date) {
        return res.status(400).json({ error: 'device_id, name, and date are required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Generate a unique event ID for custom events
      const customEventId = `CUSTOM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create tables if they don't exist (same as events-v2.js)
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

      // Create the custom event in the global events table
      const [newEvent] = await sql`
        INSERT INTO events (
          id, 
          name, 
          description, 
          date, 
          time, 
          location,
          is_free,
          category,
          created_at,
          updated_at
        )
        VALUES (
          ${customEventId}, 
          ${name}, 
          ${description || ''}, 
          ${date}, 
          ${time}, 
          ${location || ''},
          true,
          'custom',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      // Add event reference to group (custom events use the event name as custom_name)
      const [eventRef] = await sql`
        INSERT INTO group_event_refs (group_id, event_id, custom_name, added_by_device_id)
        VALUES (${id}, ${customEventId}, ${name}, ${device_id})
        RETURNING *
      `;

      // Initialize empty group event data
      await sql`
        INSERT INTO group_event_data (group_id, event_id, attendance_going, attendance_maybe, attendance_not_going, expenses)
        VALUES (${id}, ${customEventId}, '{}', '{}', '{}', '{}')
      `;
      
      return res.status(201).json({ 
        success: true, 
        event: newEvent,
        event_ref: eventRef 
      });

    } catch (error) {
      console.error('Error creating custom event:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};