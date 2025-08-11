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
    const { device_id, fingerprint, username, pin } = req.body;

    if (!device_id || !fingerprint || !username || !pin) {
      return res.status(400).json({ 
        error: 'Missing required fields: device_id, fingerprint, username, pin' 
      });
    }

    // For now, we'll just store the linking information
    // In a real app, you'd want to verify the PIN and implement proper user authentication
    const userKey = `user:${username}`;
    const deviceKey = `device:${device_id}`;
    
    // Update device record with user info
    const existingDevice = await kv.get(deviceKey);
    if (!existingDevice) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Link device to user
    const linkedDeviceData = {
      ...existingDevice,
      linked_to_user: username,
      linked_at: new Date().toISOString(),
      pin_hash: pin // In production, you'd hash this properly
    };

    await kv.set(deviceKey, linkedDeviceData);

    // Also store user -> devices mapping
    const userData = await kv.get(userKey) || { username, devices: [] };
    if (!userData.devices.includes(device_id)) {
      userData.devices.push(device_id);
      await kv.set(userKey, userData);
    }

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