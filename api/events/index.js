const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // Debug mode: add ?debug=true to see raw data with image_url lengths
    const debug = req.query.debug === 'true';

    try {
      // Ensure image_url column exists
      try {
        await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT`;
      } catch (e) { /* column may already exist */ }

      // Ensure short_description column exists
      try {
        await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS short_description TEXT`;
      } catch (e) { /* column may already exist */ }

      const events = await sql`
        SELECT
          id,
          name,
          description,
          short_description,
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
          image_url,
          created_at,
          updated_at
        FROM events
        ORDER BY date DESC, created_at DESC
      `;

      if (debug) {
        const debugEvents = events.map(e => ({
          id: e.id,
          name: e.name,
          has_image_url: !!e.image_url,
          image_url_length: e.image_url ? e.image_url.length : 0,
          image_url_preview: e.image_url ? e.image_url.substring(0, 50) + '...' : null,
        }));
        return res.status(200).json({ debug: true, events: debugEvents });
      }

      return res.status(200).json({ events });

    } catch (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        name,
        description,
        short_description,
        date,
        time,
        location,
        venue_name,
        price,
        currency = 'USD',
        is_free = false,
        category,
        tags,
        max_attendees,
        min_attendees,
        attendance_required = false
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Event name is required' });
      }

      // Ensure events table exists with flexible date/time columns
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS events (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(500) NOT NULL,
            description TEXT,
            date VARCHAR(100),
            time VARCHAR(100),
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
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;

        // Try to alter existing columns to VARCHAR if they exist as DATE/TIME
        try {
          await sql`ALTER TABLE events ALTER COLUMN date TYPE VARCHAR(100)`;
        } catch (e) { /* Column might already be VARCHAR or not exist */ }
        try {
          await sql`ALTER TABLE events ALTER COLUMN time TYPE VARCHAR(100)`;
        } catch (e) { /* Column might already be VARCHAR or not exist */ }
        try {
          await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT`;
        } catch (e) { /* Column might already exist */ }
      } catch (error) {
        console.log('Events table creation:', error.message);
      }

      const eventId = `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Clean up data - convert empty strings to null for date/time fields
      const cleanDate = date && date.trim() ? date : null;
      const cleanTime = time && time.trim() ? time : null;
      const cleanTags = tags || [];
      const { image_url } = req.body;

      // Create event in global registry
      const [newEvent] = await sql`
        INSERT INTO events (
          id, name, description, short_description, date, time, location, venue_name,
          price, currency, is_free, category, tags,
          max_attendees, min_attendees, attendance_required, image_url
        )
        VALUES (
          ${eventId}, ${name}, ${description || null}, ${short_description || null}, ${cleanDate}, ${cleanTime},
          ${location || null}, ${venue_name || null}, ${price || 0}, ${currency}, ${is_free},
          ${category || null}, ${cleanTags}, ${max_attendees || null}, ${min_attendees || null},
          ${attendance_required}, ${image_url || null}
        )
        RETURNING *
      `;
      
      return res.status(201).json(newEvent);

    } catch (error) {
      console.error('Error creating event:', error);
      console.error('Request body:', req.body);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const {
        id,
        name,
        description,
        short_description,
        date,
        time,
        location,
        venue_name,
        price,
        currency = 'USD',
        is_free = false,
        category,
        tags,
        image_url
      } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Event name is required' });
      }

      const cleanDate = date && date.trim() ? date : null;
      const cleanTime = time && time.trim() ? time : null;
      const cleanTags = tags || [];

      const [updatedEvent] = await sql`
        UPDATE events SET
          name = ${name},
          description = ${description || null},
          short_description = ${short_description || null},
          date = ${cleanDate},
          time = ${cleanTime},
          location = ${location || null},
          venue_name = ${venue_name || null},
          price = ${price || 0},
          currency = ${currency},
          is_free = ${is_free},
          category = ${category || null},
          tags = ${cleanTags},
          image_url = ${image_url || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      if (!updatedEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      return res.status(200).json(updatedEvent);

    } catch (error) {
      console.error('Error updating event:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { event_id } = req.body;
      if (!event_id) {
        return res.status(400).json({ error: 'event_id is required' });
      }
      const result = await sql`DELETE FROM events WHERE id = ${event_id}`;
      return res.status(200).json({ success: true, message: `Deleted event ${event_id}` });
    } catch (error) {
      console.error('Error deleting event:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};