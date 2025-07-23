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
      const { id } = req.query;
      const { device_id } = req.query;

      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Get the event and check if user has access (is member of the group)
      const [event] = await sql`
        SELECT 
          e.id,
          e.group_id,
          e.custom_name,
          e.original_event_data,
          e.created_at,
          e.updated_at,
          e.created_by_device_id,
          m.username as created_by_username,
          
          -- New schema fields (will be null for legacy events)
          e.name,
          e.description,
          e.date,
          e.time,
          e.timezone,
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
          e.schema_version
          
        FROM group_events e
        LEFT JOIN members m ON e.created_by_device_id = m.device_id AND m.group_id = e.group_id
        WHERE e.id = ${id}
      `;

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if user is a member of the group this event belongs to
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${event.group_id} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Determine if this is a legacy event or new schema event
      const isLegacyEvent = !event.schema_version || event.schema_version === 'legacy';
      
      if (isLegacyEvent) {
        // Return legacy format
        const legacyEvent = {
          id: event.id,
          custom_name: event.custom_name,
          original_event_data: event.original_event_data,
          created_by_device_id: event.created_by_device_id,
          created_by_username: event.created_by_username,
          created_at: event.created_at,
          schema_version: 'legacy'
        };
        
        return res.status(200).json(legacyEvent);
      } else {
        // Return new schema format
        const newEvent = {
          id: event.id,
          group_id: event.group_id,
          custom_name: event.custom_name,
          name: event.name,
          description: event.description,
          date: event.date,
          time: event.time,
          timezone: event.timezone,
          location: event.location,
          venue_name: event.venue_name,
          price: event.price,
          currency: event.currency,
          is_free: event.is_free,
          category: event.category,
          tags: event.tags,
          max_attendees: event.max_attendees,
          min_attendees: event.min_attendees,
          attendance_required: event.attendance_required,
          created_by_device_id: event.created_by_device_id,
          created_by_username: event.created_by_username,
          created_at: event.created_at,
          updated_at: event.updated_at,
          original_event_data: event.original_event_data,
          schema_version: event.schema_version
        };
        
        return res.status(200).json(newEvent);
      }

    } catch (error) {
      console.error('Error fetching event:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
};