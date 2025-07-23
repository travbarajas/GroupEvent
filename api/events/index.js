const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // Get all events from global registry
      // This will be used by the Events tab to show all available events
      const events = await sql`
        SELECT 
          id,
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
          created_at,
          updated_at
        FROM events
        ORDER BY date DESC, created_at DESC
      `;
      
      return res.status(200).json({ events });

    } catch (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        name,
        description,
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

      // Ensure events table exists
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
      } catch (error) {
        console.log('Events table creation:', error.message);
      }

      const eventId = `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Create event in global registry
      const [newEvent] = await sql`
        INSERT INTO events (
          id, name, description, date, time, location, venue_name,
          price, currency, is_free, category, tags, 
          max_attendees, min_attendees, attendance_required
        )
        VALUES (
          ${eventId}, ${name}, ${description}, ${date}, ${time}, 
          ${location}, ${venue_name}, ${price}, ${currency}, ${is_free}, 
          ${category}, ${tags}, ${max_attendees}, ${min_attendees}, ${attendance_required}
        )
        RETURNING *
      `;
      
      return res.status(201).json(newEvent);

    } catch (error) {
      console.error('Error creating event:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};