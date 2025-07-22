const { neon } = require('@neondatabase/serverless');

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
    return getGroupAvailability(req, res);
  } else if (req.method === 'POST') {
    return saveUserAvailability(req, res);
  } else if (req.method === 'PUT') {
    return updateUserAvailability(req, res);
  } else if (req.method === 'DELETE') {
    return deleteUserAvailability(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getGroupAvailability(req, res) {
  try {
    const { groupId, startDate, endDate } = req.query;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    try {
      // First, ensure the availability table exists
      await sql`
        CREATE TABLE IF NOT EXISTS availability (
          id SERIAL PRIMARY KEY,
          group_id VARCHAR(255) NOT NULL,
          device_id VARCHAR(255) NOT NULL,
          date DATE NOT NULL,
          start_hour DECIMAL(3,1) NOT NULL,
          end_hour DECIMAL(3,1) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Build the query with optional date filters
      let availabilityQuery = sql`
        SELECT 
          a.*,
          m.username,
          m.device_id
        FROM availability a
        LEFT JOIN members m ON a.device_id = m.device_id AND m.group_id = ${groupId}
        WHERE a.group_id = ${groupId}
      `;

      // Add date filters if provided
      let availability;
      if (startDate && endDate) {
        availability = await sql`
          SELECT 
            a.*,
            m.username,
            m.device_id
          FROM availability a
          LEFT JOIN members m ON a.device_id = m.device_id AND m.group_id = ${groupId}
          WHERE a.group_id = ${groupId}
            AND a.date >= ${startDate}
            AND a.date <= ${endDate}
          ORDER BY a.date ASC
        `;
      } else if (startDate) {
        availability = await sql`
          SELECT 
            a.*,
            m.username,
            m.device_id
          FROM availability a
          LEFT JOIN members m ON a.device_id = m.device_id AND m.group_id = ${groupId}
          WHERE a.group_id = ${groupId}
            AND a.date >= ${startDate}
          ORDER BY a.date ASC
        `;
      } else if (endDate) {
        availability = await sql`
          SELECT 
            a.*,
            m.username,
            m.device_id
          FROM availability a
          LEFT JOIN members m ON a.device_id = m.device_id AND m.group_id = ${groupId}
          WHERE a.group_id = ${groupId}
            AND a.date <= ${endDate}
          ORDER BY a.date ASC
        `;
      } else {
        availability = await sql`
          SELECT 
            a.*,
            m.username,
            m.device_id
          FROM availability a
          LEFT JOIN members m ON a.device_id = m.device_id AND m.group_id = ${groupId}
          WHERE a.group_id = ${groupId}
          ORDER BY a.date ASC
        `;
      }

      // Transform the data for easier client-side processing
      const availabilityByMember = availability.reduce((acc, slot) => {
        const memberId = slot.device_id;
        if (!acc[memberId]) {
          acc[memberId] = {
            memberId,
            username: slot.username,
            deviceId: slot.device_id,
            slots: []
          };
        }
        acc[memberId].slots.push({
          date: slot.date,
          startHour: slot.start_hour,
          endHour: slot.end_hour,
          id: slot.id
        });
        return acc;
      }, {});

      res.status(200).json({
        availability: Object.values(availabilityByMember),
        totalMembers: Object.keys(availabilityByMember).length
      });
    } catch (error) {
      console.error('Error fetching availability:', error);
      // If there's an error, return empty data instead of failing
      res.status(200).json({
        availability: [],
        totalMembers: 0
      });
    }
  } catch (error) {
    console.error('Error in getGroupAvailability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function saveUserAvailability(req, res) {
  try {
    const { groupId, memberId, deviceId, slots } = req.body;

    if (!groupId || !deviceId || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the member belongs to the group
    const [memberData] = await sql`
      SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${deviceId}
    `;

    if (!memberData) {
      return res.status(403).json({ error: 'Member not found in group' });
    }

    // Delete existing availability for these dates (if any slots provided)
    const dates = [...new Set(slots.map(slot => slot.date))];
    
    if (dates.length > 0) {
      for (const date of dates) {
        await sql`
          DELETE FROM availability 
          WHERE group_id = ${groupId} 
            AND device_id = ${deviceId} 
            AND date = ${date}
        `;
      }
    }

    // Insert new availability slots
    if (slots.length > 0) {
      for (const slot of slots) {
        await sql`
          INSERT INTO availability (group_id, device_id, date, start_hour, end_hour, created_at)
          VALUES (${groupId}, ${deviceId}, ${slot.date}, ${slot.startHour}, ${slot.endHour}, CURRENT_TIMESTAMP)
        `;
      }
      res.status(201).json({ message: 'Availability saved successfully' });
    } else {
      res.status(200).json({ message: 'Availability cleared successfully' });
    }
  } catch (error) {
    console.error('Error in saveUserAvailability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateUserAvailability(req, res) {
  // For simplicity, redirect to save function which handles updates
  return saveUserAvailability(req, res);
}

async function deleteUserAvailability(req, res) {
  try {
    const { groupId, deviceId, slotIds } = req.body;

    if (!groupId || !deviceId || !slotIds || !Array.isArray(slotIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the member belongs to the group
    const [memberData] = await sql`
      SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${deviceId}
    `;

    if (!memberData) {
      return res.status(403).json({ error: 'Member not found in group' });
    }

    // Delete the specified availability slots
    for (const slotId of slotIds) {
      await sql`
        DELETE FROM availability 
        WHERE id = ${slotId} 
          AND group_id = ${groupId} 
          AND device_id = ${deviceId}
      `;
    }

    res.status(200).json({ message: 'Availability deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUserAvailability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}