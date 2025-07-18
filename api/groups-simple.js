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
  
  if (req.method === 'POST') {
    try {
      console.log('Simple POST request received:', req.body);
      
      const { name, description } = req.body;
      
      if (!name || name.trim().length === 0) {
        console.log('Validation failed: missing name');
        return res.status(400).json({ error: 'Group name is required' });
      }

      const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      console.log('Creating group with ID:', groupId);
      
      // Only create group, no invite
      const [group] = await sql`
        INSERT INTO groups (id, name, description)
        VALUES (${groupId}, ${name.trim()}, ${description || null})
        RETURNING *
      `;

      console.log('Group created successfully:', group);

      return res.status(201).json(group);
    } catch (error) {
      console.error('Error in simple group creation:', error);
      return res.status(500).json({ 
        error: 'Failed to create group', 
        details: error.message,
        type: error.constructor.name
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};