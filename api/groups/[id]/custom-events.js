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

      // Create group_events table if it doesn't exist
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS group_events (
            id VARCHAR(255) PRIMARY KEY,
            group_id VARCHAR(255) NOT NULL,
            name VARCHAR(500) NOT NULL,
            description TEXT,
            date DATE,
            time TIME,
            location VARCHAR(500),
            venue_name VARCHAR(500),
            price DECIMAL(10,2),
            currency VARCHAR(3) DEFAULT 'USD',
            is_free BOOLEAN DEFAULT true,
            category VARCHAR(100) DEFAULT 'custom',
            tags TEXT[],
            max_attendees INTEGER,
            min_attendees INTEGER,
            attendance_required BOOLEAN DEFAULT false,
            
            -- Group-specific data
            custom_name VARCHAR(500),
            added_by_device_id VARCHAR(255) NOT NULL,
            added_by_username VARCHAR(255),
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Event data (attendance, expenses, etc.)
            attendance_going TEXT[] DEFAULT '{}',
            attendance_maybe TEXT[] DEFAULT '{}',
            attendance_not_going TEXT[] DEFAULT '{}',
            expenses JSONB DEFAULT '{}',
            notes TEXT,
            
            -- Source tracking
            source_type VARCHAR(50) DEFAULT 'custom', -- 'custom' or 'global'
            source_event_id VARCHAR(255), -- reference to global event if copied
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
          )
        `;
      } catch (error) {
        console.log('Table creation:', error.message);
      }

      // Create the custom event directly in the group's event table
      let newEvent;
      try {
        const eventResult = await sql`
          INSERT INTO group_events (
            id,
            group_id,
            name, 
            description, 
            date, 
            time, 
            location,
            is_free,
            category,
            custom_name,
            added_by_device_id,
            added_by_username,
            source_type,
            created_at,
            updated_at
          )
          VALUES (
            ${customEventId},
            ${id},
            ${name}, 
            ${description || ''}, 
            ${date}, 
            ${time}, 
            ${location || ''},
            true,
            'custom',
            ${name},
            ${device_id},
            ${membership.username || 'Unknown'},
            'custom',
            CURRENT_TIMESTAMP,
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