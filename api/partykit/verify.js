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
    const { token, device_id, room_type, room_id } = req.body;
    
    if (!token || !device_id || !room_type || !room_id) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Missing required parameters' 
      });
    }

    // Verify the token (simple JWT-like verification)
    try {
      const [header, payload, signature] = token.split('.');
      if (!header || !payload || !signature) {
        return res.status(400).json({ valid: false, error: 'Invalid token format' });
      }

      // Decode payload
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      
      // Check if token is expired (1 hour expiry)
      if (Date.now() > decodedPayload.exp) {
        return res.status(401).json({ valid: false, error: 'Token expired' });
      }

      // Verify device_id matches
      if (decodedPayload.device_id !== device_id) {
        return res.status(401).json({ valid: false, error: 'Device ID mismatch' });
      }

      // Verify signature using your secret
      const expectedSignature = crypto
        .createHmac('sha256', process.env.PARTYKIT_SECRET || 'default-secret')
        .update(`${header}.${payload}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return res.status(401).json({ valid: false, error: 'Invalid signature' });
      }

    } catch (error) {
      return res.status(401).json({ valid: false, error: 'Token verification failed' });
    }

    // Verify user has access to the room
    let hasAccess = false;
    
    if (room_type === 'group') {
      // Check if user is a member of the group
      const [membership] = await sql`
        SELECT 1 FROM members 
        WHERE group_id = ${room_id} AND device_id = ${device_id}
      `;
      hasAccess = !!membership;
    } else if (room_type === 'event') {
      // For events, check if user is a member of the group that owns the event
      const [eventAccess] = await sql`
        SELECT 1 FROM group_events ge
        JOIN members m ON ge.group_id = m.group_id
        WHERE ge.id = ${room_id} AND m.device_id = ${device_id}
      `;
      hasAccess = !!eventAccess;
    }

    if (!hasAccess) {
      return res.status(403).json({ 
        valid: false, 
        error: 'User does not have access to this room' 
      });
    }

    return res.status(200).json({ 
      valid: true,
      room_type,
      room_id 
    });

  } catch (error) {
    console.error('PartyKit verification error:', error);
    return res.status(500).json({ 
      valid: false, 
      error: 'Internal server error' 
    });
  }
};