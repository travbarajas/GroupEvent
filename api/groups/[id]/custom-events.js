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
      
      // Debug logging
      console.log('Received data:', { device_id, name, description, date, time, location });
      
      if (!device_id || !name || !date) {
        return res.status(400).json({ error: 'device_id, name, and date are required' });
      }

      // Check if user is a member of this group
      let membership;
      try {
        const membershipResult = await sql`
          SELECT username FROM members WHERE group_id = ${id} AND device_id = ${device_id}
        `;
        membership = membershipResult[0];
      } catch (membershipError) {
        console.error('Error checking membership:', membershipError);
        return res.status(500).json({ error: 'Error checking group membership' });
      }

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Generate a unique event ID for this group
      const customEventId = `${id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create group_events table if it doesn't exist, or add missing columns
      try {
        // First create the table if it doesn't exist
        await sql`
          CREATE TABLE IF NOT EXISTS group_events (
            id VARCHAR(255) PRIMARY KEY,
            group_id VARCHAR(255) NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
          )
        `;

        // Add columns one by one to handle existing tables
        const columns = [
          'name VARCHAR(500)',
          'description TEXT',
          'date DATE',
          'time TIME',
          'location VARCHAR(500)',
          'venue_name VARCHAR(500)',
          'price DECIMAL(10,2)',
          'currency VARCHAR(3) DEFAULT \'USD\'',
          'is_free BOOLEAN DEFAULT true',
          'category VARCHAR(100) DEFAULT \'custom\'',
          'tags TEXT[]',
          'max_attendees INTEGER',
          'min_attendees INTEGER',
          'attendance_required BOOLEAN DEFAULT false',
          'custom_name VARCHAR(500)',
          'added_by_device_id VARCHAR(255)',
          'added_by_username VARCHAR(255)',
          'added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
          'attendance_going TEXT[] DEFAULT \'{}\'',
          'attendance_maybe TEXT[] DEFAULT \'{}\'',
          'attendance_not_going TEXT[] DEFAULT \'{}\'',
          'expenses JSONB DEFAULT \'{}\'',
          'notes TEXT',
          'source_type VARCHAR(50) DEFAULT \'custom\'',
          'source_event_id VARCHAR(255)',
          'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
          'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        ];

        for (const column of columns) {
          try {
            await sql`ALTER TABLE group_events ADD COLUMN ${sql.unsafe(column)}`;
          } catch (columnError) {
            // Column already exists, ignore
            if (!columnError.message.includes('already exists')) {
              console.log('Column add error:', columnError.message);
            }
          }
        }
      } catch (error) {
        console.log('Table setup error:', error.message);
      }

      // Create the custom event directly in the group's event table
      let newEvent;
      try {
        // Create the original_event_data structure to match existing schema
        const originalEventData = {
          name: name,
          description: description || '',
          date: date || '',
          time: time || '',
          location: location || '',
          venue_name: '',
          price: 0,
          currency: 'USD',
          is_free: true,
          category: 'custom',
          tags: [],
          max_attendees: null,
          min_attendees: null,
          attendance_required: false
        };

        const eventResult = await sql`
          INSERT INTO group_events (
            id,
            group_id,
            custom_name,
            original_event_data,
            created_by_device_id,
            created_at
          )
          VALUES (
            ${customEventId},
            ${id},
            ${name},
            ${JSON.stringify(originalEventData)},
            ${device_id},
            CURRENT_TIMESTAMP
          )
          RETURNING *
        `;
        newEvent = eventResult[0];
      } catch (insertError) {
        console.error('Error creating event:', insertError);
        return res.status(500).json({ error: 'Error creating event: ' + insertError.message });
      }
      
      return res.status(201).json({ 
        success: true, 
        event: newEvent
      });

    } catch (error) {
      console.error('Error creating custom event:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};