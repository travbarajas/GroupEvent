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
      const { device_id, user_info, events, group_id } = req.query;

      // If events parameter is present, return group events
      if (events === 'true' && group_id && device_id) {
        // Check if user is a member of this group
        const [membership] = await sql`
          SELECT 1 FROM members WHERE group_id = ${group_id} AND device_id = ${device_id}
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
            LEFT JOIN members m ON e.created_by_device_id = m.device_id AND m.group_id = ${group_id}
            WHERE e.group_id = ${group_id}
            ORDER BY e.created_at DESC
          `;
          
          return res.status(200).json({ events: groupEvents });
        } catch (error) {
          console.error('Error fetching group events:', error);
          // If table doesn't exist yet, return empty events
          return res.status(200).json({ events: [] });
        }
      }
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // If user_info parameter is present, return user info instead of groups
      if (user_info === 'true') {
        const [member] = await sql`
          SELECT username, 
                 CASE WHEN username IS NOT NULL AND LENGTH(TRIM(username)) > 0 
                      THEN true 
                      ELSE false 
                 END as has_username
          FROM members 
          WHERE device_id = ${device_id} 
          LIMIT 1
        `;
        
        if (!member) {
          return res.status(200).json({ 
            username: null, 
            has_username: false 
          });
        }
        
        return res.status(200).json(member);
      }

      // Automatically clean up any empty groups before returning results
      try {
        await sql`
          DELETE FROM groups 
          WHERE id IN (
            SELECT g.id 
            FROM groups g
            LEFT JOIN members m ON g.id = m.group_id
            WHERE m.group_id IS NULL
          )
        `;
        console.log('Cleaned up empty groups automatically');
      } catch (cleanupError) {
        console.log('Auto cleanup error (non-critical):', cleanupError.message);
      }

      // Only return groups where the user is a member
      const groups = await sql`
        SELECT g.*, COUNT(m.id) as actual_member_count
        FROM groups g
        INNER JOIN members m ON g.id = m.group_id
        WHERE g.id IN (
          SELECT group_id FROM members WHERE device_id = ${device_id}
        )
        GROUP BY g.id, g.name, g.description, g.member_count, g.created_at, g.updated_at
        ORDER BY g.created_at DESC
      `;
      
      return res.status(200).json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('POST request received:', req.body);

      // Check if this is an event save request
      console.log('Checking for event save request. Body contains:', Object.keys(req.body));
      console.log('Body values:', {
        has_original_event: !!req.body.original_event,
        has_group_id: !!req.body.group_id,
        group_id_value: req.body.group_id,
        original_event_exists: typeof req.body.original_event
      });
      if (req.body.original_event && req.body.group_id) {
        console.log('Detected event save request');
        const { group_id, device_id, custom_name, original_event } = req.body;
        
        if (!group_id) {
          return res.status(400).json({ error: 'group_id is required' });
        }
        
        if (!device_id) {
          return res.status(400).json({ error: 'device_id is required' });
        }

        if (!original_event) {
          return res.status(400).json({ error: 'original_event data is required' });
        }

        // Check if user is a member of this group
        const [membership] = await sql`
          SELECT 1 FROM members WHERE group_id = ${group_id} AND device_id = ${device_id}
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
          console.log('Ensured group_events table exists');
        } catch (error) {
          console.log('Table creation error:', error.message);
        }

        const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        console.log('Attempting to save event:', { eventId, group_id, custom_name });
        
        // Save event to group
        const [savedEvent] = await sql`
          INSERT INTO group_events (id, group_id, custom_name, original_event_data, created_by_device_id)
          VALUES (${eventId}, ${group_id}, ${custom_name || null}, ${JSON.stringify(original_event)}, ${device_id})
          RETURNING *
        `;
        
        console.log('Event saved successfully:', savedEvent);
        
        return res.status(201).json({ 
          success: true,
          event: savedEvent
        });
      }

      // If we get here, this is a group creation request, not an event save request
      // First, ensure role column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN role VARCHAR(20) DEFAULT 'member'
        `;
        console.log('Added role column to members table');
      } catch (error) {
        console.log('Role column already exists or error:', error.message);
      }

      // Ensure username column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN username VARCHAR(50)
        `;
        console.log('Added username column to members table');
      } catch (error) {
        console.log('Username column already exists or error:', error.message);
      }

      // Ensure profile_picture column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN profile_picture TEXT
        `;
        console.log('Added profile_picture column to members table');
      } catch (error) {
        console.log('Profile_picture column already exists or error:', error.message);
      }
      
      const { name, description, device_id } = req.body;
      
      if (!name || name.trim().length === 0) {
        console.log('Validation failed: missing name');
        return res.status(400).json({ error: 'Group name is required' });
      }

      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      console.log('Creating group with ID:', groupId);
      
      // Create group
      const [group] = await sql`
        INSERT INTO groups (id, name, description)
        VALUES (${groupId}, ${name.trim()}, ${description || null})
        RETURNING *
      `;

      console.log('Group created:', group);

      // Add creator as member with creator role
      await sql`
        INSERT INTO members (id, group_id, device_id, role)
        VALUES (${`member_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`}, ${groupId}, ${device_id}, 'creator')
      `;

      // Create default invite
      const inviteResult = await sql`
        INSERT INTO invites (id, group_id, invite_code, created_by)
        VALUES (${`invite_${Date.now()}`}, ${groupId}, ${inviteCode}, ${device_id})
        RETURNING *
      `;

      console.log('Invite created successfully:', inviteResult);
      console.log('Invite code:', inviteCode);

      return res.status(201).json({ 
        ...group, 
        invite_code: inviteCode 
      });
    } catch (error) {
      console.error('Detailed error creating group:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Failed to create group', 
        details: error.message,
        type: error.constructor.name
      });
    }
  }

  if (req.method === 'PUT') {
    console.log('🎯 PUT REQUEST HIT /api/groups/index.js');
    try {
      const { device_id, username, color } = req.body;
      console.log('🔧 PUT request received:', { device_id, username, color });
      
      if (!device_id || !username) {
        return res.status(400).json({ error: 'device_id and username are required' });
      }

      // Ensure color column exists in members table
      try {
        await sql`
          ALTER TABLE members 
          ADD COLUMN color VARCHAR(7) DEFAULT '#60a5fa'
        `;
        console.log('Added color column to members table');
      } catch (error) {
        console.log('Color column already exists or error:', error.message);
      }

      // Update username and color for this device across all groups they're in
      const updateData = {
        username: username.trim(),
        ...(color && { color })
      };

      if (color) {
        const result = await sql`
          UPDATE members 
          SET username = ${username.trim()}, color = ${color}
          WHERE device_id = ${device_id}
          RETURNING username, color
        `;
        console.log('📊 Update result with color:', result);
        return res.status(200).json({ 
          success: true, 
          message: 'Profile updated successfully',
          username: username.trim(),
          color: color
        });
      } else {
        const result = await sql`
          UPDATE members 
          SET username = ${username.trim()}
          WHERE device_id = ${device_id}
          RETURNING username
        `;
        console.log('📊 Update result without color:', result);
        return res.status(200).json({ 
          success: true, 
          message: 'Username updated successfully',
          username: username.trim()
        });
      }
    } catch (error) {
      console.error('Error updating username:', error);
      return res.status(500).json({ error: 'Failed to update username' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};