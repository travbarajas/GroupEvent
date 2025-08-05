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
  
  const { id: groupId, eventId } = req.query;

  if (req.method === 'GET') {
    // Get attendance for an event
    try {
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Get attendance records for this event
      const attendanceRecords = await sql`
        SELECT device_id, status 
        FROM event_attendance 
        WHERE group_id = ${groupId} AND event_id = ${eventId}
      `;
      
      const attendance = {
        going: [],
        maybe: [],
        not_going: []
      };
      
      attendanceRecords.forEach(row => {
        if (attendance[row.status]) {
          attendance[row.status].push(row.device_id);
        }
      });
      
      return res.status(200).json(attendance);
    } catch (error) {
      console.error('Error fetching event attendance:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch attendance',
        details: error.message 
      });
    }
  }

  if (req.method === 'POST') {
    // Update user's attendance status
    const { device_id, status } = req.body;
    
    if (!device_id || !status) {
      return res.status(400).json({ 
        error: 'device_id and status are required' 
      });
    }

    if (!['going', 'maybe', 'not_going'].includes(status)) {
      return res.status(400).json({ 
        error: 'status must be one of: going, maybe, not_going' 
      });
    }

    try {
      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Create the event_attendance table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS event_attendance (
          id SERIAL PRIMARY KEY,
          group_id VARCHAR(255) NOT NULL,
          event_id VARCHAR(255) NOT NULL,
          device_id VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(group_id, event_id, device_id)
        )
      `;

      // Insert or update attendance status using UPSERT
      await sql`
        INSERT INTO event_attendance (group_id, event_id, device_id, status, created_at, updated_at)
        VALUES (${groupId}, ${eventId}, ${device_id}, ${status}, NOW(), NOW())
        ON CONFLICT (group_id, event_id, device_id)
        DO UPDATE SET 
          status = EXCLUDED.status,
          updated_at = NOW()
      `;

      return res.status(200).json({ 
        success: true,
        status: status
      });
    } catch (error) {
      console.error('Error updating event attendance:', error);
      return res.status(500).json({ 
        error: 'Failed to update attendance',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};