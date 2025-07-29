const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { device_id, room_type, room_id } = req.body;
    
    if (!device_id || !room_type || !room_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Verify user has access to the room
    let userInfo = null;
    
    if (room_type === 'group') {
      // Check if user is a member of the group
      const [membership] = await sql`
        SELECT username, color FROM members 
        WHERE group_id = ${room_id} AND device_id = ${device_id}
      `;
      
      if (!membership) {
        return res.status(403).json({ error: 'User is not a member of this group' });
      }
      
      userInfo = membership;
    } else if (room_type === 'event') {
      // For events, check if user is a member of the group that owns the event
      const [eventAccess] = await sql`
        SELECT m.username, m.color FROM group_events ge
        JOIN members m ON ge.group_id = m.group_id
        WHERE ge.id = ${room_id} AND m.device_id = ${device_id}
      `;
      
      if (!eventAccess) {
        return res.status(403).json({ error: 'User does not have access to this event' });
      }
      
      userInfo = eventAccess;
    } else {
      return res.status(400).json({ error: 'Invalid room_type' });
    }

    // Generate token (simple JWT-like structure)
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      device_id,
      room_type,
      room_id,
      username: userInfo.username,
      userColor: userInfo.color || '#60a5fa',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', process.env.PARTYKIT_SECRET || 'default-secret')
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const token = `${encodedHeader}.${encodedPayload}.${signature}`;

    return res.status(200).json({
      token,
      user: {
        device_id,
        username: userInfo.username,
        userColor: userInfo.color || '#60a5fa',
      },
      room: {
        type: room_type,
        id: room_id,
      },
      expires_at: payload.exp * 1000, // Convert to milliseconds
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
};