const { neon } = require('@neondatabase/serverless');

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

    // Check if device exists
    const [existingDevice] = await sql`
      SELECT * FROM device_fingerprints WHERE device_id = ${device_id}
    `;
    
    if (!existingDevice) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Update device record with user info
    await sql`
      UPDATE device_fingerprints 
      SET 
        linked_to_user = ${username},
        linked_at = CURRENT_TIMESTAMP,
        pin_hash = ${pin}
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