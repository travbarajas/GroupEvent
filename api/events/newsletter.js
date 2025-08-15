const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { device_id } = req.query;
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    console.log(`📅 Fetching global events for newsletter selection`);

    // Get all global events (business/venue events) that appear on the main events tab
    const allEvents = await sql`
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
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'  -- Events from last 30 days to future
      ORDER BY date ASC, time ASC
    `;

    console.log(`✅ Found ${allEvents.length} global events for newsletter`);

    // Format events for frontend
    const formattedEvents = allEvents.map(event => {
      console.log(`📅 API Event: ${event.name}, Raw Date: ${event.date}, Type: ${typeof event.date}`);
      return {
        id: event.id,
        name: event.name || 'Untitled Event',
        description: event.description || '',
        date: event.date ? event.date.toISOString().split('T')[0] : null, // Ensure YYYY-MM-DD format
        time: event.time || '',
        location: event.location || '',
        venueName: event.venue_name || '',
        price: event.price ? parseFloat(event.price) : null,
        currency: event.currency || 'USD',
        isFree: event.is_free,
        category: event.category || 'general',
        tags: event.tags || [],
        maxAttendees: event.max_attendees,
        minAttendees: event.min_attendees,
        attendanceRequired: event.attendance_required,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        // Format date for display (use the corrected date)
        displayDate: event.date ? (() => {
          const dateStr = event.date.toISOString().split('T')[0];
          const [year, month, day] = dateStr.split('-').map(Number);
          const localDate = new Date(year, month - 1, day);
          return localDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
          });
        })() : '',
        // Combine location fields for display
        fullLocation: [event.venue_name, event.location].filter(Boolean).join(' - ')
      };
    });

    return res.status(200).json({
      events: formattedEvents,
      total: formattedEvents.length
    });

  } catch (error) {
    console.error('❌ Error fetching all events:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch events',
      details: error.message 
    });
  }
};