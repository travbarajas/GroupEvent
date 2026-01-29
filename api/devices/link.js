const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { device_id, fingerprint, username, pin } = req.body;

    if (!device_id || !fingerprint || !username || !pin) {
      return res.status(400).json({
        error: 'Missing required fields: device_id, fingerprint, username, pin'
      });
    }

    // Validate username (3-50 characters)
    if (username.trim().length < 3 || username.trim().length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
    }

    // Validate username format (letters, numbers, spaces, and basic punctuation only)
    if (!/^[a-zA-Z0-9\s._-]+$/.test(username.trim())) {
      return res.status(400).json({
        error: 'Username can only contain letters, numbers, spaces, periods, underscores, and hyphens'
      });
    }

    // Validate PIN (4-8 digits only)
    if (!/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({
        error: 'PIN must be 4-8 digits'
      });
    }

    // Check if device exists
    const [existingDevice] = await sql`
      SELECT * FROM device_fingerprints WHERE device_id = ${device_id}
    `;
    
    if (!existingDevice) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Hash the PIN before storing (10 rounds is standard)
    const pinHash = await bcrypt.hash(pin, 10);

    // Update device record with user info
    await sql`
      UPDATE device_fingerprints
      SET
        linked_to_user = ${username},
        linked_at = CURRENT_TIMESTAMP,
        pin_hash = ${pinHash}
      WHERE device_id = ${device_id}
    `;

    console.log(`🔗 Device ${device_id} linked to user ${username}`);

    res.status(200).json({ 
      success: true, 
      message: 'Device linked to user successfully' 
    });

  } catch (error) {
    console.error('❌ Error linking device to user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}