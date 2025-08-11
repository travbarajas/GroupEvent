import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fingerprint } = req.query;

    if (!fingerprint) {
      return res.status(400).json({ 
        error: 'Missing fingerprint parameter' 
      });
    }

    console.log(`🔍 Looking up fingerprint: ${fingerprint}`);

    // Decode the fingerprint if it was URL encoded
    const decodedFingerprint = decodeURIComponent(fingerprint);
    const fingerprintKey = `fingerprint:${decodedFingerprint}`;
    
    // Look up device by fingerprint
    const deviceData = await kv.get(fingerprintKey);
    
    if (!deviceData) {
      console.log(`❌ No device found for fingerprint: ${decodedFingerprint}`);
      return res.status(404).json({ 
        error: 'No device found for this fingerprint' 
      });
    }

    console.log(`✅ Found device for fingerprint: ${decodedFingerprint} -> ${deviceData.device_id}`);

    res.status(200).json({ 
      device_id: deviceData.device_id,
      fingerprint: deviceData.fingerprint,
      registered_at: deviceData.registered_at
    });

  } catch (error) {
    console.error('❌ Error looking up device by fingerprint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}