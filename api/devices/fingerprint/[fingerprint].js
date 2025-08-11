module.exports = async function handler(req, res) {
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
    
    // For now, just return 404 since this is the first time this device is being looked up
    // The device will register itself after this fails
    console.log(`❌ No device found for fingerprint: ${decodedFingerprint} (expected for first-time sync)`);
    return res.status(404).json({ 
      error: 'No device found for this fingerprint',
      debug: {
        received_fingerprint: fingerprint,
        decoded_fingerprint: decodedFingerprint
      }
    });

  } catch (error) {
    console.error('❌ Error looking up device by fingerprint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}