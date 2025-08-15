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

    console.log(`📅 Fetching all events for device: ${device_id}`);

    // Get all groups the user is a member of, then get events from those groups
    const allEvents = await sql`
      SELECT DISTINCT
        ge.id,
        ge.group_id,
        ge.name,
        ge.description,
        ge.date,
        ge.time,
        ge.location,
        ge.venue_name,
        ge.price,
        ge.currency,
        ge.is_free,
        ge.category,
        ge.custom_name,
        ge.added_at,
        g.name as group_name
      FROM group_events ge
      INNER JOIN groups g ON ge.group_id = g.id
      INNER JOIN members m ON g.id = m.group_id
      WHERE m.device_id = ${device_id}
        AND ge.date >= CURRENT_DATE - INTERVAL '30 days'  -- Events from last 30 days to future
      ORDER BY ge.date ASC, ge.time ASC
    `;

    console.log(`✅ Found ${allEvents.length} events across user's groups`);

    // Format events for frontend
    const formattedEvents = allEvents.map(event => ({
      id: event.id,
      groupId: event.group_id,
      groupName: event.group_name,
      name: event.name || event.custom_name || 'Untitled Event',
      description: event.description || '',
      date: event.date,
      time: event.time || '',
      location: event.location || '',
      venueName: event.venue_name || '',
      price: event.price ? parseFloat(event.price) : null,
      currency: event.currency || 'USD',
      isFree: event.is_free,
      category: event.category || 'custom',
      addedAt: event.added_at,
      // Format date for display
      displayDate: event.date ? new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      }) : '',
      // Combine location fields for display
      fullLocation: [event.venue_name, event.location].filter(Boolean).join(' - ')
    }));

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