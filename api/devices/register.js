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
    const { device_id, fingerprint } = req.body;

    if (!device_id || !fingerprint) {
      return res.status(400).json({ 
        error: 'Missing required fields: device_id and fingerprint' 
      });
    }

    // Create device_fingerprints table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS device_fingerprints (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        fingerprint VARCHAR(255) NOT NULL,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        linked_to_user VARCHAR(255),
        linked_at TIMESTAMP,
        pin_hash VARCHAR(255)
      )
    `;

    // Insert or update device-fingerprint mapping
    await sql`
      INSERT INTO device_fingerprints (device_id, fingerprint)
      VALUES (${device_id}, ${fingerprint})
      ON CONFLICT (device_id)
      DO UPDATE SET 
        fingerprint = EXCLUDED.fingerprint,
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log(`📱 Device registered: ${device_id} with fingerprint: ${fingerprint}`);

    res.status(200).json({ 
      success: true, 
      message: 'Device registered successfully',
      device_id,
      fingerprint
    });

  } catch (error) {
    console.error('❌ Error registering device:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}