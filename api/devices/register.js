import { kv } from '@vercel/kv';

export default async function handler(req, res) {
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

    // Store device-fingerprint mapping
    const deviceKey = `device:${device_id}`;
    const fingerprintKey = `fingerprint:${fingerprint}`;
    
    // Store both mappings for bidirectional lookup
    await Promise.all([
      kv.set(deviceKey, { 
        device_id, 
        fingerprint, 
        registered_at: new Date().toISOString() 
      }),
      kv.set(fingerprintKey, { 
        device_id, 
        fingerprint, 
        registered_at: new Date().toISOString() 
      })
    ]);

    console.log(`📱 Device registered: ${device_id} with fingerprint: ${fingerprint}`);

    res.status(200).json({ 
      success: true, 
      message: 'Device registered successfully',
      device_id,
      fingerprint
    });

  } catch (error) {
    console.error('❌ Error registering device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}