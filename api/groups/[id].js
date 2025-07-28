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
      const { id, device_id, profile, events } = req.query;

      // If events parameter is present, return group events
      if (events === 'true' && device_id) {
        // Check if user is a member of this group
        const [membership] = await sql`
          SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
        `;

        if (!membership) {
          return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Get all events for this group
        try {
          const groupEvents = await sql`
            SELECT 
              e.id,
              e.custom_name,
              e.original_event_data,
              e.created_at,
              e.created_by_device_id,
              m.username as created_by_username,
              m.color as created_by_color
            FROM group_events e
            LEFT JOIN members m ON e.created_by_device_id = m.device_id AND m.group_id = ${id}
            WHERE e.group_id = ${id}
            ORDER BY e.created_at DESC
          `;
          
          return res.status(200).json({ events: groupEvents });
        } catch (error) {
          console.error('Error fetching group events:', error);
          // If table doesn't exist yet, return empty events
          return res.status(200).json({ events: [] });
        }
      }

      // If profile parameter is present, return user's profile for this group
      if (profile === 'true' && device_id) {
        // Ensure color column exists before querying
        try {
          await sql`
            ALTER TABLE members 
            ADD COLUMN color VARCHAR(7) DEFAULT '#60a5fa'
          `;
        } catch (error) {
          // Column already exists
        }
        
        const [member] = await sql`
          SELECT username, profile_picture, 
                 COALESCE(color, '#60a5fa') as color,
                 CASE WHEN username IS NOT NULL AND LENGTH(TRIM(username)) > 0 
                      THEN true 
                      ELSE false 
                 END as has_username,
                 CASE WHEN color IS NOT NULL AND LENGTH(TRIM(color)) > 0 
                      THEN true 
                      ELSE false 
                 END as has_color
          FROM members 
          WHERE group_id = ${id} AND device_id = ${device_id}
        `;
        
        console.log('👤 Profile query result:', member);
        
        if (!member) {
          return res.status(404).json({ error: 'You are not a member of this group' });
        }
        
        return res.status(200).json(member);
      }

      // Get group with its invite code
      const [group] = await sql`
        SELECT g.*, i.invite_code
        FROM groups g
        LEFT JOIN invites i ON g.id = i.group_id
        WHERE g.id = ${id}
        LIMIT 1
      `;

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.status(200).json(group);
    } catch (error) {
      console.error('Error fetching group:', error);
      return res.status(500).json({ error: 'Failed to fetch group' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('POST request to groups/[id] endpoint:', req.body);
      const { id } = req.query;
      const { device_id, custom_name, original_event } = req.body;
      
      // Check if this is an event save request
      if (original_event) {
        console.log('Detected event save request');
        
        if (!device_id) {
          return res.status(400).json({ error: 'device_id is required' });
        }

        if (!original_event) {
          return res.status(400).json({ error: 'original_event data is required' });
        }

        // Check if user is a member of this group
        const [membership] = await sql`
          SELECT 1 FROM members WHERE group_id = ${id} AND device_id = ${device_id}
        `;

        if (!membership) {
          return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Ensure group_events table exists
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS group_events (
              id VARCHAR(255) PRIMARY KEY,
              group_id VARCHAR(255) NOT NULL,
              custom_name TEXT,
              original_event_data JSONB NOT NULL,
              created_by_device_id VARCHAR(255) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
            )
          `;
        } catch (error) {
          console.log('Table already exists or error:', error.message);
        }

        const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Save event to group
        const [savedEvent] = await sql`
          INSERT INTO group_events (id, group_id, custom_name, original_event_data, created_by_device_id)
          VALUES (${eventId}, ${id}, ${custom_name || null}, ${JSON.stringify(original_event)}, ${device_id})
          RETURNING *
        `;
        
        return res.status(201).json({ 
          success: true,
          event: savedEvent
        });
      } else {
        // This is not an event save request, return method not allowed for now
        return res.status(405).json({ error: 'Method not allowed for this request type' });
      }
    } catch (error) {
      console.error('Error saving event to group:', error);
      return res.status(500).json({ error: 'Failed to save event to group' });
    }
  }

  if (req.method === 'PUT') {
    console.log('🎯 PUT REQUEST HIT /api/groups/[id].js');
    try {
      const { id } = req.query;
      const { device_id, username, profile_picture, color } = req.body;
      
      console.log('🔧 PUT request received:', { device_id, username, profile_picture, color });
      
      if (!device_id || !username) {
        return res.status(400).json({ error: 'device_id and username are required' });
      }

      // Ensure color column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN color VARCHAR(7) DEFAULT '#60a5fa'
        `;
        console.log('✅ Color column ensured');
      } catch (error) {
        console.log('Color column already exists');
      }

      // Update username, profile picture, and color for this specific group membership
      const [updatedMember] = await sql`
        UPDATE members 
        SET username = ${username.trim()}, 
            profile_picture = ${profile_picture || null},
            color = ${color || '#60a5fa'}
        WHERE group_id = ${id} AND device_id = ${device_id}
        RETURNING username, profile_picture, color
      `;
      
      console.log('📊 Updated member result:', updatedMember);

      if (!updatedMember) {
        return res.status(404).json({ error: 'You are not a member of this group' });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Profile updated successfully',
        username: updatedMember.username,
        profile_picture: updatedMember.profile_picture,
        color: updatedMember.color
      });
    } catch (error) {
      console.error('Error updating group profile:', error);
      return res.status(500).json({ error: 'Failed to update group profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};