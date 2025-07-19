const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
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

  return res.status(405).json({ error: 'Method not allowed' });
};