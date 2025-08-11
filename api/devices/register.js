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

    // For now, just log and return success
    // Database operations temporarily disabled to test basic functionality
    console.log(`📱 Device registration requested: ${device_id} with fingerprint: ${fingerprint}`);

    res.status(200).json({ 
      success: true, 
      message: 'Device registration logged (database temporarily disabled for testing)',
      device_id,
      fingerprint
    });

  } catch (error) {
    console.error('❌ Error registering device:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}