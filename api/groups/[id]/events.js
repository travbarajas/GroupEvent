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

      // Ensure color column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#60a5fa'
        `;
      } catch (error) {
        // Column already exists
      }

      // Get all events for this group from the group_events table with creator colors
      console.log('🔧 FETCHING EVENTS WITH COLOR JOIN - v2.0');
      let events = [];
      try {
        events = await sql`
          SELECT 
            e.id,
            e.group_id,
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
            e.custom_name,
            e.added_by_device_id as created_by_device_id,
            e.added_by_username as created_by_username,
            e.added_at as created_at,
            e.attendance_going,
            e.attendance_maybe,
            e.attendance_not_going,
            e.expenses,
            e.notes,
            e.source_type,
            e.source_event_id,
            m.color as created_by_color
          FROM group_events e
          LEFT JOIN members m ON e.added_by_device_id = m.device_id AND m.group_id = ${id}
          WHERE e.group_id = ${id}
          ORDER BY e.added_at DESC
        `;
      } catch (queryError) {
        console.log('Query failed, table may not exist yet:', queryError.message);
        // Return empty events array if table doesn't exist
        events = [];
      }

      // Transform events to match the expected format for backward compatibility
      const transformedEvents = events.map(event => ({
        id: event.id,
        custom_name: event.custom_name,
        created_by_device_id: event.created_by_device_id,
        created_by_username: event.created_by_username,
        created_at: event.created_at,
        original_event_data: {
          name: event.name,
          description: event.description,
          date: event.date,
          time: event.time,
          location: event.location,
          venue_name: event.venue_name,
          price: event.price,
          currency: event.currency,
          is_free: event.is_free,
          category: event.category,
          tags: event.tags,
          max_attendees: event.max_attendees,
          min_attendees: event.min_attendees,
          attendance_required: event.attendance_required
        },
        attendance_going: event.attendance_going,
        attendance_maybe: event.attendance_maybe,
        attendance_not_going: event.attendance_not_going,
        expenses: event.expenses,
        notes: event.notes,
        source_type: event.source_type,
        source_event_id: event.source_event_id
      }));
      
      return res.status(200).json({ events: transformedEvents });
    } catch (error) {
      console.error('Error fetching group events:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id } = req.query;
      const { device_id, event_id, custom_name, source_event } = req.body;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT username FROM members WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      let newEvent;

      if (source_event) {
        // Adding a global event - copy it to the group's event table
        const groupEventId = `${id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        [newEvent] = await sql`
          INSERT INTO group_events (
            id,
            group_id,
            name,
            description,
            date,
            time,
            location,
            venue_name,
            price,
            currency,
            is_free,
            category,
            tags,
            max_attendees,
            min_attendees,
            attendance_required,
            custom_name,
            added_by_device_id,
            added_by_username,
            source_type,
            source_event_id
          )
          VALUES (
            ${groupEventId},
            ${id},
            ${source_event.name},
            ${source_event.description || ''},
            ${source_event.date},
            ${source_event.time},
            ${source_event.location || ''},
            ${source_event.venue_name || ''},
            ${source_event.price || 0},
            ${source_event.currency || 'USD'},
            ${source_event.is_free || false},
            ${source_event.category || ''},
            ${source_event.tags || '{}'},
            ${source_event.max_attendees},
            ${source_event.min_attendees},
            ${source_event.attendance_required || false},
            ${custom_name || source_event.name},
            ${device_id},
            ${membership.username || 'Unknown'},
            'global',
            ${event_id}
          )
          RETURNING *
        `;
      } else {
        return res.status(400).json({ error: 'source_event is required when adding global events' });
      }
      
      return res.status(201).json({ success: true, event: newEvent });

    } catch (error) {
      console.error('Error adding event to group:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      const { device_id, event_id } = req.body;
      
      if (!device_id || !event_id) {
        return res.status(400).json({ error: 'device_id and event_id are required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT username FROM members WHERE group_id = ${id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Check if the event exists and if the user is the creator
      const [event] = await sql`
        SELECT * FROM group_events 
        WHERE id = ${event_id} AND group_id = ${id}
      `;

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if user is the creator of the event
      if (event.added_by_device_id !== device_id && event.created_by_device_id !== device_id) {
        return res.status(403).json({ error: 'Only the event creator can delete this event' });
      }

      // Delete the event
      await sql`
        DELETE FROM group_events 
        WHERE id = ${event_id} AND group_id = ${id}
      `;

      return res.status(200).json({ success: true, message: 'Event deleted successfully' });

    } catch (error) {
      console.error('Error deleting event:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};