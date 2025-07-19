const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      const [profile] = await sql`
        SELECT * FROM profiles WHERE device_id = ${device_id}
      `;
      
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      return res.status(200).json(profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Ensure profiles table exists
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS profiles (
            id VARCHAR(50) PRIMARY KEY,
            device_id VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(50) NOT NULL,
            profile_picture TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
      } catch (error) {
        console.log('Error creating profiles table:', error.message);
      }

      const { device_id, username, profile_picture } = req.body;
      
      if (!device_id || !username) {
        return res.status(400).json({ error: 'device_id and username are required' });
      }

      const profileId = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Insert or update profile
      const [profile] = await sql`
        INSERT INTO profiles (id, device_id, username, profile_picture)
        VALUES (${profileId}, ${device_id}, ${username}, ${profile_picture || null})
        ON CONFLICT (device_id) 
        DO UPDATE SET 
          username = EXCLUDED.username,
          profile_picture = EXCLUDED.profile_picture,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      return res.status(201).json(profile);
    } catch (error) {
      console.error('Error creating/updating profile:', error);
      return res.status(500).json({ error: 'Failed to create/update profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};