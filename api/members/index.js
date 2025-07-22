const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  if (req.method === 'GET' && action === 'me') {
    return getUserInfo(req, res);
  } else if (req.method === 'POST' && action === 'username') {
    return updateUsername(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
};

async function getUserInfo(req, res) {
  try {
    const { device_id } = req.query;
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    // Get user info from any membership record (usernames are synced across all memberships)
    const [member] = await sql`
      SELECT username, 
             CASE WHEN username IS NOT NULL AND LENGTH(TRIM(username)) > 0 
                  THEN true 
                  ELSE false 
             END as has_username
      FROM members 
      WHERE device_id = ${device_id} 
      LIMIT 1
    `;
    
    if (!member) {
      return res.status(200).json({ 
        username: null, 
        has_username: false 
      });
    }
    
    return res.status(200).json(member);
  } catch (error) {
    console.error('Error fetching user info:', error);
    return res.status(500).json({ error: 'Failed to fetch user info' });
  }
}

async function updateUsername(req, res) {
  try {
    const { device_id, username } = req.body;
    
    if (!device_id || !username) {
      return res.status(400).json({ error: 'device_id and username are required' });
    }

    // Update username for this device across all groups they're in
    await sql`
      UPDATE members 
      SET username = ${username.trim()}
      WHERE device_id = ${device_id}
    `;
    
    return res.status(200).json({ success: true, message: 'Username updated successfully' });
  } catch (error) {
    console.error('Error updating username:', error);
    return res.status(500).json({ error: 'Failed to update username' });
  }
}